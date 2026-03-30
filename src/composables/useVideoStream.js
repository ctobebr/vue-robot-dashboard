import { ref } from 'vue'

export function useVideoStream() {
  const videoSrc = ref('')
  const isConnected = ref(false)
  const error = ref(null)

  function connect(streamUrl) {
    if (!streamUrl) {
      error.value = 'Stream URL is required'
      return false
    }

    videoSrc.value = streamUrl
    isConnected.value = true
    error.value = null
    return true
  }

  function disconnect() {
    videoSrc.value = ''
    isConnected.value = false
  }

  function refresh() {
    if (videoSrc.value) {
      const timestamp = Date.now()
      const separator = videoSrc.value.includes('?') ? '&' : '?'
      videoSrc.value = `${videoSrc.value}${separator}_t=${timestamp}`
    }
  }

  function setConnected(connected) {
    isConnected.value = connected
  }

  return {
    videoSrc,
    isConnected,
    error,
    connect,
    disconnect,
    refresh,
    setConnected
  }
}