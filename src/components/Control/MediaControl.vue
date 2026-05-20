<template>
  <div class="media-control">
    <div
      class="media-btn camera-btn"
      @click="handleCameraClick"
      :title="t('camera')"
    >
      <el-icon><Camera /></el-icon>
      <span v-if="photoCount > 0" class="photo-badge">
        {{ photoCount > 99 ? '99+' : photoCount }}
      </span>
    </div>
    <div
      class="media-btn recorder-btn"
      :class="{ recording: recorderActive }"
      @click="handleRecorderClick"
      :title="recorderActive ? t('recording') : t('recorder')"
    >
      <el-icon><VideoCamera /></el-icon>
      <div v-if="recorderActive" class="recording-indicator">
        <span class="recording-dot"></span>
        <span class="recording-time">{{ formattedRecordingTime }}</span>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, computed, onUnmounted } from 'vue'
import { useI18n } from 'vue-i18n'
import { Camera, VideoCamera } from '@element-plus/icons-vue'
import { ElIcon, ElMessage } from 'element-plus'

const { t } = useI18n()
const emit = defineEmits(['camera-click', 'recorder-click'])

const props = defineProps({
  videoVisible: {
    type: Boolean,
    default: true
  }
})

const photoCount = ref(0)
const recorderActive = ref(false)
const recordingTime = ref(0)
const recordingTimer = ref(null)

const formattedRecordingTime = computed(() => {
  const minutes = Math.floor(recordingTime.value / 60)
  const seconds = recordingTime.value % 60
  return `${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`
})

function startRecordingTimer() {
  recordingTime.value = 0
  recordingTimer.value = setInterval(() => {
    recordingTime.value++
  }, 1000)
}

function stopRecordingTimer() {
  if (recordingTimer.value) {
    clearInterval(recordingTimer.value)
    recordingTimer.value = null
  }
  recordingTime.value = 0
}

function handleCameraClick() {
  if (!props.videoVisible) {
    ElMessage.warning(t('pleaseEnableCamera'))
    return
  }
  photoCount.value++
  emit('camera-click')
}

function handleRecorderClick() {
  if (!props.videoVisible) {
    ElMessage.warning(t('pleaseEnableCamera'))
    return
  }
  recorderActive.value = !recorderActive.value
  if (recorderActive.value) {
    startRecordingTimer()
  } else {
    stopRecordingTimer()
  }
  emit('recorder-click', recorderActive.value)
}

onUnmounted(() => {
  stopRecordingTimer()
})
</script>

<style scoped>
.media-control {
  display: flex;
  flex-direction: column;
  gap: 16px;
  align-items: center;
  z-index: 100;
  user-select: none;
}

.media-btn {
  width: 64px;
  height: 64px;
  border-radius: 50%;
  background-color: rgba(255, 255, 255, 0.1);
  border: 2px solid rgba(255, 255, 255, 0.2);
  display: flex;
  align-items: center;
  justify-content: center;
  cursor: pointer;
  transition: all 0.2s ease;
  position: relative;
  overflow: hidden;
  -webkit-tap-highlight-color: transparent;
}

.media-btn:hover {
  background-color: rgba(255, 255, 255, 0.15);
  border-color: #409eff;
  transform: scale(1.05);
}

.media-btn:active {
  transform: scale(0.95);
}

.media-btn.active {
  background-color: rgba(64, 158, 255, 0.2);
  border-color: #409eff;
  box-shadow: 0 0 15px rgba(64, 158, 255, 0.3);
}

.media-btn.active::before {
  content: '';
  position: absolute;
  top: 50%;
  left: 50%;
  width: 120%;
  height: 120%;
  background: radial-gradient(circle, rgba(64, 158, 255, 0.3) 0%, transparent 70%);
  transform: translate(-50%, -50%);
  animation: pulse 2s infinite;
}

@keyframes pulse {
  0% {
    transform: translate(-50%, -50%) scale(1);
    opacity: 0.6;
  }
  50% {
    transform: translate(-50%, -50%) scale(1.1);
    opacity: 0.3;
  }
  100% {
    transform: translate(-50%, -50%) scale(1);
    opacity: 0.6;
  }
}

.photo-badge {
  position: absolute;
  top: 4px;
  right: 4px;
  min-width: 18px;
  height: 18px;
  padding: 0 4px;
  border-radius: 9px;
  background-color: #10b981;
  color: #fff;
  font-size: 10px;
  font-weight: 600;
  display: flex;
  align-items: center;
  justify-content: center;
  box-shadow: 0 2px 4px rgba(0, 0, 0, 0.3);
  z-index: 10;
}

.recorder-btn.recording {
  background-color: rgba(239, 68, 68, 0.2);
  border-color: #ef4444;
  box-shadow: 0 0 15px rgba(239, 68, 68, 0.3);
}

.recorder-btn.recording::before {
  content: '';
  position: absolute;
  top: 50%;
  left: 50%;
  width: 120%;
  height: 120%;
  background: radial-gradient(circle, rgba(239, 68, 68, 0.3) 0%, transparent 70%);
  transform: translate(-50%, -50%);
  animation: pulse 2s infinite;
}

.recording-indicator {
  position: absolute;
  bottom: 8px;
  left: 50%;
  transform: translateX(-50%);
  display: flex;
  flex-direction: row;
  align-items: center;
  gap: 4px;
  background-color: rgba(0, 0, 0, 0.6);
  padding: 2px 6px;
  border-radius: 10px;
}

.recording-dot {
  width: 8px;
  height: 8px;
  border-radius: 50%;
  background-color: #ef4444;
}

.recording-time {
  font-size: 11px;
  color: #fff;
  font-weight: 600;
  font-family: monospace;
}

@keyframes blink {
  0%, 100% {
    opacity: 1;
  }
  50% {
    opacity: 0.3;
  }
}

/* 响应式设计 */
@media screen and (max-width: 768px) {
  .media-btn {
    width: 56px;
    height: 56px;
  }
  
  .media-btn :deep(.ph-icon) {
    width: 28px;
    height: 28px;
  }
}

@media screen and (max-width: 480px) {
  .media-btn {
    width: 48px;
    height: 48px;
  }
  
  .media-btn :deep(.ph-icon) {
    width: 24px;
    height: 24px;
  }
}
</style>