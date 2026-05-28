import { ref } from 'vue'
import { useSocket } from './useSocket'
import { useDeviceStore } from '@/stores/device'
import {
  getNextSessionId,
  createRecordControlMessage,
  createMappingControlMessage
} from '@/utils/protocol'

/**
 * 设备控制组合式函数
 * 提供通过 WebSocket 控制设备录制和映射的功能
 * @returns {Object} 包含控制方法和状态的对象
 */
export function useDeviceControl() {
  const { connected, sendCommand } = useSocket()
  const deviceStore = useDeviceStore()

  const isControlling = ref(false)
  const lastError = ref(null)

  /**
   * 检查是否可以发送命令
   * @returns {boolean} 是否可以发送
   */
  function canSendCommand() {
    if (!deviceStore.currentDevice) {
      lastError.value = '未选择设备'
      return false
    }

    if (!connected.value) {
      lastError.value = 'WebSocket未连接'
      return false
    }

    return true
  }

  /**
   * 发送录制控制命令
   * @param {'start'|'end'|'reset'|string} control - 控制类型
   * @param {number} [sessionId] - 可选的会话ID（用于关联多条命令）
   * @returns {boolean} 是否发送成功
   */
  function sendRecordControl(control, sessionId) {
    if (!canSendCommand()) return false

    const message = createRecordControlMessage(control, sessionId ? { sessionId } : {})
    const result = sendCommand(deviceStore.currentDevice, 'device:record', message)
    return result
  }

  /**
   * 发送映射控制命令
   * @param {'start'|'end'|'reset'} control - 控制类型
   * @param {number} [sessionId] - 可选的会话ID（用于关联多条命令）
   * @returns {boolean} 是否发送成功
   */
  function sendMappingControl(control, sessionId) {
    if (!canSendCommand()) return false

    const message = createMappingControlMessage(control, sessionId ? { sessionId } : {})
    const result = sendCommand(deviceStore.currentDevice, 'device:mapping', message)
    return result
  }

  /**
   * 开始录制
   * 发送两条命令：录制控制(start) + 映射控制(start)
   * 两条命令使用同一个 sessionId 以便后端关联
   * @param {string} [dataName] - 录制数据名称（可选）
   * @returns {boolean} 是否发送成功
   */
  function startRecording(dataName) {
    isControlling.value = true
    lastError.value = null

    if (!canSendCommand()) {
      isControlling.value = false
      return false
    }

    const sessionId = getNextSessionId()
    const recordControl = dataName || 'start'

    const recordResult = sendRecordControl(recordControl, sessionId)
    const mappingResult = sendMappingControl('start', sessionId)

    isControlling.value = false

    if (recordResult && mappingResult) {
      deviceStore.setRecording(true)
      return true
    } else {
      return false
    }
  }

  /**
   * 停止录制
   * 发送两条命令：录制控制(end) + 映射控制(end)
   * 两条命令使用同一个 sessionId 以便后端关联
   * @returns {boolean} 是否发送成功
   */
  function stopRecording() {
    isControlling.value = true
    lastError.value = null

    if (!canSendCommand()) {
      isControlling.value = false
      return false
    }

    const sessionId = getNextSessionId()

    const recordResult = sendRecordControl('end', sessionId)
    const mappingResult = sendMappingControl('end', sessionId)

    isControlling.value = false

    if (recordResult && mappingResult) {
      deviceStore.setRecording(false)
      return true
    } else {
      return false
    }
  }

  /**
   * 重置映射
   * 发送两条命令：录制控制(reset) + 映射控制(reset)
   * 两条命令使用同一个 sessionId 以便后端关联
   * @returns {boolean} 是否发送成功
   */
  function resetMapping() {
    isControlling.value = true
    lastError.value = null

    if (!canSendCommand()) {
      isControlling.value = false
      return false
    }

    const sessionId = getNextSessionId()

    const recordResult = sendRecordControl('reset', sessionId)
    const mappingResult = sendMappingControl('reset', sessionId)

    isControlling.value = false

    if (recordResult && mappingResult) {
      return true
    } else {
      return false
    }
  }

  return {
    isControlling,
    lastError,
    connected,
    startRecording,
    stopRecording,
    resetMapping,
    sendRecordControl,
    sendMappingControl
  }
}
