<template>
  <div class="video-wrapper">
    <!-- 视频面板 -->
    <div class="video-display" v-if="!isMinimized">
      <div class="video-header">
        <h3>{{ t('videoPanel') }}</h3>
        <div class="video-controls">
          <div class="control-icon" @click="toggleFullscreen" :title="t('fullscreen')">
            <el-icon><FullScreen /></el-icon>
          </div>
          <div class="control-icon" @click="refreshVideo" :title="t('refresh')">
            <el-icon><Refresh /></el-icon>
          </div>
          <div class="control-icon minimize" @click="minimize" :title="t('minimize')">
            <el-icon><Minus /></el-icon>
          </div>
        </div>
      </div>
      <div class="video-container">
        <div class="video-placeholder" v-if="!videoSrc">
          <el-icon><VideoCamera /></el-icon>
          <p>{{ t('noVideoFeed') }}</p>
        </div>
        <video 
          v-else 
          class="video-player"
          :src="videoSrc"
          autoplay
          muted
          playsinline
        ></video>
      </div>
      <div class="video-footer">
        <span class="status-indicator" :class="{ active: isConnected }">{{ isConnected ? t('connected') : t('disconnected') }}</span>
      </div>
    </div>

    <!-- 最小化后的悬浮恢复按钮 -->
    <div 
      v-else 
      class="video-restore-btn"
      @click="restore"
      :title="t('restoreVideoPanel')"
    >
      <div class="restore-icon">
        <el-icon><VideoCamera /></el-icon>
      </div>
      <div class="restore-pulse"></div>
    </div>
  </div>
</template>

<script setup>
import { ref, defineProps, defineEmits } from 'vue'
import { useI18n } from 'vue-i18n'
import { VideoCamera, FullScreen, Refresh, Minus } from '@element-plus/icons-vue'
import { ElIcon } from 'element-plus'

const { t } = useI18n()

const props = defineProps({
  videoSrc: {
    type: String,
    default: ''
  },
  isConnected: {
    type: Boolean,
    default: false
  }
})

const emit = defineEmits(['refresh', 'fullscreen', 'minimize-change'])

const isMinimized = ref(false)

function toggleFullscreen() {
  emit('fullscreen')
}

function refreshVideo() {
  emit('refresh')
}

function minimize() {
  isMinimized.value = true
  emit('minimize-change', true)
}

function restore() {
  isMinimized.value = false
  emit('minimize-change', false)
}

// 暴露方法给父组件
defineExpose({
  minimize,
  restore,
  isMinimized: () => isMinimized.value
})
</script>

<style scoped>
.video-wrapper {
  position: relative;
}

.video-display {
  background-color: rgba(0, 0, 0, 0.7);
  border-radius: 8px;
  border: 1px solid rgba(255, 255, 255, 0.2);
  overflow: hidden;
  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.3);
  z-index: 100;
  max-width: 480px;
  width: 100%;
  user-select: none;
}

.video-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 12px 16px;
  background-color: rgba(255, 255, 255, 0.05);
  border-bottom: 1px solid rgba(255, 255, 255, 0.1);
}

.video-header h3 {
  font-size: 14px;
  font-weight: 500;
  margin: 0;
  color: #ffffff;
}

.video-controls {
  display: flex;
  gap: 8px;
}

.control-icon {
  width: 28px;
  height: 28px;
  border-radius: 4px;
  background-color: rgba(255, 255, 255, 0.1);
  display: flex;
  align-items: center;
  justify-content: center;
  cursor: pointer;
  transition: all 0.2s ease;
}

.control-icon:hover {
  background-color: rgba(255, 255, 255, 0.15);
}

.control-icon.minimize:hover {
  background-color: rgba(245, 158, 11, 0.3);
}

.video-container {
  position: relative;
  padding-bottom: 56.25%; /* 9:16 宽高比 */
  background-color: #000000;
}

.video-player {
  position: absolute;
  top: 0;
  left: 0;
  width: 100%;
  height: 100%;
  object-fit: cover;
}

.video-placeholder {
  position: absolute;
  top: 0;
  left: 0;
  width: 100%;
  height: 100%;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  background-color: #1a1a1a;
  color: #666;
  gap: 12px;
}

.video-footer {
  padding: 8px 16px;
  background-color: rgba(255, 255, 255, 0.05);
  border-top: 1px solid rgba(255, 255, 255, 0.1);
  display: flex;
  justify-content: flex-end;
}

.status-indicator {
  font-size: 12px;
  padding: 2px 8px;
  border-radius: 12px;
  background-color: rgba(255, 0, 0, 0.2);
  color: #ff4d4f;
  transition: all 0.3s ease;
}

.status-indicator.active {
  background-color: rgba(0, 255, 0, 0.2);
  color: #52c41a;
}

/* 最小化后的悬浮恢复按钮 */
.video-restore-btn {
  position: fixed;
  top: 60px;
  left: 20px;
  width: 48px;
  height: 48px;
  border-radius: 50%;
  background: linear-gradient(135deg, #409eff 0%, #67c23a 100%);
  display: flex;
  align-items: center;
  justify-content: center;
  cursor: pointer;
  box-shadow: 0 4px 12px rgba(64, 158, 255, 0.4);
  z-index: 1000;
  transition: all 0.3s ease;
}

.video-restore-btn:hover {
  transform: scale(1.1);
  box-shadow: 0 6px 20px rgba(64, 158, 255, 0.5);
}

.restore-icon {
  color: #ffffff;
  font-size: 20px;
  z-index: 2;
}

.restore-pulse {
  position: absolute;
  top: 50%;
  left: 50%;
  width: 100%;
  height: 100%;
  border-radius: 50%;
  background: rgba(64, 158, 255, 0.4);
  transform: translate(-50%, -50%);
  animation: pulse-ring 2s ease-out infinite;
  z-index: 1;
}

@keyframes pulse-ring {
  0% {
    transform: translate(-50%, -50%) scale(1);
    opacity: 0.8;
  }
  100% {
    transform: translate(-50%, -50%) scale(1.8);
    opacity: 0;
  }
}

/* 响应式设计 */
@media screen and (max-width: 768px) {
  .video-display {
    max-width: 320px;
  }
  
  .video-header {
    padding: 8px 12px;
  }
  
  .video-header h3 {
    font-size: 12px;
  }
  
  .control-icon {
    width: 24px;
    height: 24px;
  }

  .video-restore-btn {
    width: 40px;
    height: 40px;
    top: 100px;
    left: 12px;
  }

  .restore-icon {
    font-size: 16px;
  }
}

@media screen and (max-width: 480px) {
  .video-display {
    max-width: 240px;
  }
  
  .video-placeholder :deep(.ph-icon) {
    width: 32px;
    height: 32px;
  }
  
  .video-placeholder p {
    font-size: 12px;
  }

  .video-restore-btn {
    width: 36px;
    height: 36px;
    top: 100px;
    left: 8px;
  }

  .restore-icon {
    font-size: 14px;
  }
}

@media screen and (min-width: 1441px) {
  .video-restore-btn {
    width: 56px;
    height: 56px;
    top: 120px;
    left: 24px;
  }

  .restore-icon {
    font-size: 24px;
  }
}
</style>
