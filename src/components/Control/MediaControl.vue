<template>
  <div class="media-control">
    <div 
      class="media-btn camera-btn" 
      :class="{ active: cameraActive }"
      @click="handleCameraClick"
      :title="t('camera')"
    >
      <el-icon><Camera /></el-icon>
    </div>
    <div 
      class="media-btn recorder-btn" 
      :class="{ active: recorderActive }"
      @click="handleRecorderClick"
      :title="t('recorder')"
    >
      <el-icon><VideoCamera /></el-icon>
    </div>
  </div>
</template>

<script setup>
import { ref } from 'vue'
import { useI18n } from 'vue-i18n'
import { Camera, VideoCamera } from '@element-plus/icons-vue'
import { ElIcon } from 'element-plus'

const { t } = useI18n()
const emit = defineEmits(['camera-click', 'recorder-click'])

const cameraActive = ref(false)
const recorderActive = ref(false)

function handleCameraClick() {
  cameraActive.value = !cameraActive.value
  emit('camera-click', cameraActive.value)
}

function handleRecorderClick() {
  recorderActive.value = !recorderActive.value
  emit('recorder-click', recorderActive.value)
}
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