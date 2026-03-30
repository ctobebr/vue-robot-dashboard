import { ref } from 'vue'
import { robotAPI } from '@/services/api'

export function useMediaControl() {
  const isRecording = ref(false)
  const isCapturing = ref(false)
  const lastCapturedImage = ref(null)
  const recordingSessionId = ref(null)

  async function capture() {
    if (isCapturing.value) return null

    isCapturing.value = true

    try {
      const response = await robotAPI.capture()

      if (response.data.code === 0 && response.data.data) {
        lastCapturedImage.value = response.data.data.imageUrl
        return lastCapturedImage.value
      }

      return null
    } catch (error) {
      console.error('Capture failed:', error)
      return null
    } finally {
      isCapturing.value = false
    }
  }

  async function startRecord() {
    if (isRecording.value) return false

    try {
      const response = await robotAPI.startRecord()

      if (response.data.code === 0 && response.data.data) {
        recordingSessionId.value = response.data.data.sessionId
        isRecording.value = true
        return true
      }

      return false
    } catch (error) {
      console.error('Start recording failed:', error)
      return false
    }
  }

  async function stopRecord() {
    if (!isRecording.value) return null

    try {
      const response = await robotAPI.stopRecord(recordingSessionId.value)

      if (response.data.code === 0 && response.data.data) {
        const videoUrl = response.data.data.videoUrl
        isRecording.value = false
        recordingSessionId.value = null
        return videoUrl
      }

      return null
    } catch (error) {
      console.error('Stop recording failed:', error)
      return null
    }
  }

  function setRecordingState(recording) {
    isRecording.value = recording
  }

  return {
    isRecording,
    isCapturing,
    lastCapturedImage,
    capture,
    startRecord,
    stopRecord,
    setRecordingState
  }
}