<template>
  <div class="video-display">
    <div class="video-header">
      <h3>{{ t('videoFeed') }}</h3>
      <div class="video-controls">
        <div class="control-icon" @click="toggleFullscreen" title="Fullscreen">
          <el-icon><FullScreen /></el-icon>
        </div>
        <div class="control-icon" @click="refreshVideo" title="Refresh">
          <el-icon><Refresh /></el-icon>
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
</template>

<script setup>
import { ref, defineProps, defineEmits } from 'vue'
import { useI18n } from 'vue-i18n'
import { VideoCamera, FullScreen, Refresh } from '@element-plus/icons-vue'
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

const emit = defineEmits(['refresh', 'fullscreen'])

function toggleFullscreen() {
  emit('fullscreen')
}

function refreshVideo() {
  emit('refresh')
}
</script>

<style scoped>
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

.video-container {
  position: relative;
  padding-bottom: 56.25%; /* 16:9 aspect ratio */
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
  
  .control-icon :deep(.ph-icon) {
    width: 16px;
    height: 16px;
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
}
</style>