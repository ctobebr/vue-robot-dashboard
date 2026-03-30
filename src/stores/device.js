
// ### 1.3 设备状态管理修改

// #### 修改原因：

// - 适配后端重构后的设备状态数据格式
// - 确保状态更新与后端API调用同步

// #### 文件：`vue-3d-viewer/src/stores/device.js`


import { defineStore } from 'pinia'
import { ref, onUnmounted, watch } from 'vue'
import { deviceAPI } from '../services/api'

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

  function setSn(newSn) {
    sn.value = newSn
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

  // 开始录制
  async function startRecording(dataName) {
    try {
      await deviceAPI.startRecording(sn.value, dataName)
      recording.value = true
    } catch (err) {
      console.error('Failed to start recording:', err)
    }
  }

  // 停止录制
  async function stopRecording() {
    try {
      await deviceAPI.stopRecording(sn.value)
      recording.value = false
    } catch (err) {
      console.error('Failed to stop recording:', err)
    }
  }

  // 重置映射
  async function resetMapping() {
    try {
      await deviceAPI.resetMapping(sn.value)
    } catch (err) {
      console.error('Failed to reset mapping:', err)
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
    setSn,
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
