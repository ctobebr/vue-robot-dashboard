import { defineStore } from 'pinia'
import { ref, onUnmounted, watch, nextTick } from 'vue'
import { deviceAPI } from '../services/api'
import {
  getNextSessionId,
  createRecordControlMessage,
  createMappingControlMessage,
  createWebSocketMessage
} from '@/utils/protocol'

let timer = null

export const useDeviceStore = defineStore('device', () => {
  const sn = ref(import.meta.env.VITE_DEVICE_SN || '')
  const status = ref('offline')
  const recording = ref(false)
  const usage = ref({
    cpu: 0,
    memory: 0,
    disk: 0
  })
  const recordingTime = ref(0)
  const networks = ref(JSON.parse(
    localStorage.getItem('networks') ||
    '{"ip": "192.168.1.251", "gw": "192.168.1.1", "netMask": "255.255.0.0"}'
  ))
  // 当前选中的设备ID（用于WebSocket控制）
  const currentDevice = ref('')

  function setSn(newSn) {
    sn.value = newSn
  }

  function setCurrentDevice(deviceId) {
    currentDevice.value = deviceId
  }

  function setStatus(newStatus) {
    status.value = newStatus
  }

  function setRecording(newRecording) {
    recording.value = newRecording

    if (!newRecording) {
      recordingTime.value = 0
    }

    if (newRecording && !timer) {
      timer = setInterval(() => {
        recordingTime.value++
      }, 1000)
    } else if (!newRecording && timer) {
      clearInterval(timer)
      timer = null
    }
  }

  function setUsage(newUsage) {
    usage.value = newUsage
  }

  function setRecordingTime(newTime) {
    recordingTime.value = newTime
  }

  function setNetworks(newNetworks) {
    networks.value = newNetworks
    localStorage.setItem('networks', JSON.stringify(newNetworks))
  }

  /**
   * 检查是否可以发送命令
   * @returns {boolean} 是否可以发送
   */
  function canSendCommand() {
    if (!currentDevice.value) {
      return false
    }

    const stompClient = window.__stompClient__
    if (!stompClient || !stompClient.connected) {
      return false
    }

    return true
  }

  /**
   * 通过 WebSocket 发送设备控制命令
   * @param {Object} message - 协议消息对象
   * @returns {boolean} 是否发送成功
   */
  function sendDeviceCommand(message) {
    if (!canSendCommand()) return false

    const token = localStorage.getItem('token')
    const stompClient = window.__stompClient__

    const wsMessage = createWebSocketMessage(message, currentDevice.value)

    stompClient.publish({
      destination: '/app/device/command',
      body: JSON.stringify(wsMessage),
      headers: { Authorization: `Bearer ${token || ''}` }
    })

    return true
  }

  /**
   * 发送录制控制命令
   * @param {'start'|'end'|'reset'|string} control - 控制类型
   * @param {number} [sessionId] - 可选的会话ID
   * @returns {boolean} 是否发送成功
   */
  function sendRecordControl(control, sessionId) {
    const message = createRecordControlMessage(control, sessionId ? { sessionId } : {})
    return sendDeviceCommand(message)
  }

  /**
   * 发送映射控制命令
   * @param {'start'|'end'|'reset'} control - 控制类型
   * @param {number} [sessionId] - 可选的会话ID
   * @returns {boolean} 是否发送成功
   */
  function sendMappingControl(control, sessionId) {
    const message = createMappingControlMessage(control, sessionId ? { sessionId } : {})
    return sendDeviceCommand(message)
  }

  /**
   * 开始录制 - 使用 WebSocket 发送两条命令
   * 两条命令使用同一个 sessionId 以便后端关联
   * @param {string} [dataName] - 录制数据名称
   */
  async function startRecording(dataName) {
    try {
      if (!canSendCommand()) {
        throw new Error('设备未连接或WebSocket未连接')
      }

      const sessionId = getNextSessionId()
      const recordControl = dataName || 'start'

      const recordResult = sendRecordControl(recordControl, sessionId)
      const mappingResult = sendMappingControl('start', sessionId)

      if (recordResult && mappingResult) {
        recording.value = true
      } else {
        throw new Error('WebSocket命令发送失败')
      }
    } catch (err) {
      throw err
    }
  }

  /**
   * 停止录制 - 使用 WebSocket 发送两条命令
   * 两条命令使用同一个 sessionId 以便后端关联
   */
  async function stopRecording() {
    try {
      if (!canSendCommand()) {
        throw new Error('设备未连接或WebSocket未连接')
      }

      const sessionId = getNextSessionId()

      const recordResult = sendRecordControl('end', sessionId)
      const mappingResult = sendMappingControl('end', sessionId)

      if (recordResult && mappingResult) {
        recording.value = false
      } else {
        throw new Error('WebSocket命令发送失败')
      }
    } catch (err) {
      throw err
    }
  }

  /**
   * 重置映射 - 重置当前建图并重新开始录制
   * 等同于：停止当前录制 + 重置映射 + 重新开始录制
   */
  async function resetMapping() {
    try {
      if (!canSendCommand()) {
        throw new Error('设备未连接或WebSocket未连接')
      }

      // 步骤1：发送 reset 命令重置映射
      let sessionId = getNextSessionId()
      const resetRecordResult = sendRecordControl('reset', sessionId)
      const resetMappingResult = sendMappingControl('reset', sessionId)

      if (!resetRecordResult || !resetMappingResult) {
        throw new Error('重置命令发送失败')
      }

      // 步骤2：发送 start 命令重新开始录制
      sessionId = getNextSessionId()
      const startRecordResult = sendRecordControl('start', sessionId)
      const startMappingResult = sendMappingControl('start', sessionId)

      if (startRecordResult && startMappingResult) {
        // 先停止录制重置计时器，再重新开始录制
        recording.value = false
        await nextTick()
        recording.value = true
      } else {
        throw new Error('启动录制命令发送失败')
      }
    } catch (err) {
      throw err
    }
  }

  // 设置网络
  async function updateNetworks(newNetworks) {
    try {
      await deviceAPI.setNetworks(sn.value, newNetworks)
      networks.value = newNetworks
      localStorage.setItem('networks', JSON.stringify(newNetworks))
    } catch (err) {
      console.error('Failed to set networks:', err)
    }
  }

  // 监听录制状态变化
  watch(recording, (newValue) => {
    if (newValue) {
      if (!timer) {
        timer = setInterval(() => {
          recordingTime.value++
        }, 1000)
      }
    } else {
      if (timer) {
        clearInterval(timer)
        timer = null
        recordingTime.value = 0
      }
    }
  })

  onUnmounted(() => {
    if (timer) {
      clearInterval(timer)
      timer = null
    }
  })

  return {
    sn,
    status,
    recording,
    usage,
    recordingTime,
    networks,
    currentDevice,
    setSn,
    setCurrentDevice,
    setStatus,
    setRecording,
    setUsage,
    setRecordingTime,
    setNetworks,
    startRecording,
    stopRecording,
    resetMapping,
    updateNetworks
  }
})
