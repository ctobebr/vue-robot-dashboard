import { defineStore } from 'pinia'
import { ref, onUnmounted } from 'vue'

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
    setNetworks
  }
})
