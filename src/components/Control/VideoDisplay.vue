<template>
  <div class="video-wrapper">
    <!-- 视频面板 -->
    <div
      class="video-display"
      v-if="!isMinimized"
      :style="{ width: panelWidth + 'px' }"
    >
      <div class="video-header">
        <h3>{{ t('videoPanel') }}</h3>
        <div class="video-controls">
          <!-- <div class="control-icon" @click="toggleFullscreen" :title="t('fullscreen')">
            <el-icon><FullScreen /></el-icon>
          </div> -->
          <div class="control-icon" @click="refreshVideo" :title="t('refresh')">
            <el-icon><Refresh /></el-icon>
          </div>
          <div class="control-icon minimize" @click="minimize" :title="t('minimize')">
            <el-icon><Minus /></el-icon>
          </div>
        </div>
      </div>
      <div class="video-container">
        <!-- WebRTC 播放器 -->
        <WebRTCPlayer
          v-if="webrtcUrl"
          ref="webrtcPlayerRef"
          :url="webrtcUrl"
        />
        <!-- 无视频流时显示黑屏 -->
        <div v-else class="video-black-screen">
          <el-icon><VideoCamera /></el-icon>
          <span>{{ t('noVideoFeed') }}</span>
        </div>
      </div>
      <div class="video-footer">
        <span class="status-indicator" :class="{ active: isConnected }">{{ isConnected ? t('connected') : t('disconnected') }}</span>
      </div>
      <!-- 拖拽调整尺寸手柄 -->
      <div
        class="resize-handle"
        @mousedown="startResize"
        @touchstart.prevent="startResizeTouch"
      >
        <svg width="12" height="12" viewBox="0 0 12 12">
          <path d="M0 0 L12 12 M4 0 L12 8 M8 0 L12 4" stroke="rgba(255,255,255,0.4)" stroke-width="1.5" />
        </svg>
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
import { computed, ref, onMounted, onUnmounted } from 'vue'
import { useI18n } from 'vue-i18n'
import { useSettingStore } from '@/stores/setting'
import { VideoCamera, FullScreen, Refresh, Minus } from '@element-plus/icons-vue'
import { ElIcon } from 'element-plus'
import WebRTCPlayer from './WebRTCPlayer.vue'

const { t } = useI18n()
const settingStore = useSettingStore()
const webrtcPlayerRef = ref(null)

const props = defineProps({
  webrtcUrl: {
    type: String,
    default: ''
  },
  isConnected: {
    type: Boolean,
    default: false
  }
})

const emit = defineEmits(['refresh', 'fullscreen', 'minimize-change'])

// 使用 store 中的视频面板状态
const videoPanel = computed(() => settingStore.videoPanel)

const isMinimized = computed({
  get: () => videoPanel.value.minimized,
  set: (val) => {
    settingStore.setVideoPanel({
      ...videoPanel.value,
      minimized: val
    })
  }
})

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
  // 恢复时触发推流请求
  emit('refresh')
}

// ========== 拖拽调整面板尺寸 ==========
const MIN_PANEL_WIDTH = 280
const MAX_PANEL_WIDTH = 800
const DEFAULT_PANEL_WIDTH = 480

const panelWidth = ref(DEFAULT_PANEL_WIDTH)
const isResizing = ref(false)

function startResize(e) {
  e.preventDefault()
  isResizing.value = true
  document.addEventListener('mousemove', onResize)
  document.addEventListener('mouseup', stopResize)
  document.body.style.userSelect = 'none'
  document.body.style.cursor = 'nwse-resize'
}

function onResize(e) {
  if (!isResizing.value) return
  // 面板在屏幕左侧，宽度 = 鼠标X坐标 - 面板左边距
  const newWidth = e.clientX - 20 // 20px 为左边距
  panelWidth.value = Math.min(MAX_PANEL_WIDTH, Math.max(MIN_PANEL_WIDTH, newWidth))
}

function stopResize() {
  isResizing.value = false
  document.removeEventListener('mousemove', onResize)
  document.removeEventListener('mouseup', stopResize)
  document.body.style.userSelect = ''
  document.body.style.cursor = ''
}

// ========== 触摸拖拽调整面板尺寸（平板适配） ==========
function startResizeTouch(e) {
  e.preventDefault()
  isResizing.value = true
  document.addEventListener('touchmove', onResizeTouch, { passive: false })
  document.addEventListener('touchend', stopResizeTouch)
  document.addEventListener('touchcancel', stopResizeTouch)
  document.body.style.userSelect = 'none'
}

function onResizeTouch(e) {
  if (!isResizing.value) return
  e.preventDefault()
  const touch = e.touches[0]
  const newWidth = touch.clientX - 20
  panelWidth.value = Math.min(MAX_PANEL_WIDTH, Math.max(MIN_PANEL_WIDTH, newWidth))
}

function stopResizeTouch() {
  isResizing.value = false
  document.removeEventListener('touchmove', onResizeTouch)
  document.removeEventListener('touchend', stopResizeTouch)
  document.removeEventListener('touchcancel', stopResizeTouch)
  document.body.style.userSelect = ''
}

// 响应式调整
function handleWindowResize() {
  if (panelWidth.value > window.innerWidth - 40) {
    panelWidth.value = Math.max(MIN_PANEL_WIDTH, window.innerWidth - 40)
  }
}

onMounted(() => {
  window.addEventListener('resize', handleWindowResize)
})

onUnmounted(() => {
  document.removeEventListener('mousemove', onResize)
  document.removeEventListener('mouseup', stopResize)
  document.removeEventListener('touchmove', onResizeTouch)
  document.removeEventListener('touchend', stopResizeTouch)
  document.removeEventListener('touchcancel', stopResizeTouch)
  window.removeEventListener('resize', handleWindowResize)
  document.body.style.userSelect = ''
  document.body.style.cursor = ''
})

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
  position: relative;
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

.video-container > * {
  position: absolute;
  top: 0;
  left: 0;
  width: 100%;
  height: 100%;
}

.video-black-screen {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  background-color: #000000;
  color: #444;
  gap: 8px;
}

.video-black-screen .el-icon {
  font-size: 32px;
}

.video-black-screen span {
  font-size: 12px;
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
  top: 100px;
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
    top: 140px;
    left: 12px;
  }

  .restore-icon {
    font-size: 16px;
  }
}

@media screen and (max-width: 480px) {
  .video-black-screen .el-icon {
    font-size: 24px;
  }

  .video-black-screen span {
    font-size: 10px;
  }

  .video-restore-btn {
    width: 36px;
    height: 36px;
    top: 140px;
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
    top: 160px;
    left: 24px;
  }

  .restore-icon {
    font-size: 24px;
  }
}

/* 拖拽调整尺寸手柄 */
.resize-handle {
  position: absolute;
  bottom: 0;
  right: 0;
  width: 20px;
  height: 20px;
  cursor: nwse-resize;
  display: flex;
  align-items: flex-end;
  justify-content: flex-end;
  padding: 0 2px 2px 0;
  z-index: 10;
  opacity: 0;
  transition: opacity 0.2s;
}

.video-display:hover .resize-handle {
  opacity: 1;
}
</style>
