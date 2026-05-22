<template>
  <div class="home-page">
    <Toolbar
      :openCommonSettings="openCommonSettings"
      :openDataListModal="openDataListModal"
      :openAuthModal="openAuthModal"
      @update:openCommonSettings="handleOpenCommonSettings"
      @update:openDataListModal="handleOpenDataListModal"
      @update:openAuthModal="handleOpenAuthModal"
    />
    <Header 
      :openSidebar="openSidebar"
      :videoVisible="videoVisible"
      @toggle-sidebar="handleToggleSidebar"
      @video-visible-change="handleVideoVisibleChange"
      @toggle-joystick-state="handleJoystickStateChange"
    />
    <Sidebar :opened="openSidebar" @close="openSidebar = false" />
    <CommonSettings :opened="openCommonSettings" @close="openCommonSettings = false" />
    <DataListModal :opened="openDataListModal" @close="openDataListModal = false" />
    <AuthModal :opened="openAuthModal" @close="openAuthModal = false" />
    <Viewer />
    
    <!-- 视频显示区域 -->
    <div class="control-panel video-panel" v-if="videoVisible">
      <VideoDisplay 
        :videoSrc="videoSrc"
        :isConnected="isVideoConnected"
        @refresh="handleVideoRefresh"
        @fullscreen="handleVideoFullscreen"
      />
    </div>
    
    <!-- 左下角Joystick -->
    <div class="control-panel joystick-left" v-show="joysticksVisible">
      <Joystick
        joystickId="left"
        :size="120"
        color="#409eff"
        :showStatus="joystickShowStatus"
        @move="handleLeftJoystickMove"
        @stop="handleLeftJoystickStop"
      />
    </div>

    <!-- 右下角Joystick -->
    <div class="control-panel joystick-right" v-show="joysticksVisible">
      <Joystick
        joystickId="right"
        :size="120"
        color="#67c23a"
        :showStatus="joystickShowStatus"
        @move="handleRightJoystickMove"
        @stop="handleRightJoystickStop"
      />
    </div>
    
    <!-- 右侧媒体控制 -->
    <div class="control-panel media-panel">
      <MediaControl
        :videoVisible="videoVisible"
        @camera-click="handleCameraClick"
        @recorder-click="handleRecorderClick"
      />
    </div>
  </div>
</template>

<script setup>
import { ref, onMounted, onUnmounted } from 'vue'
import { useRobotControl } from '@/composables/useRobotControl'
import { useMediaControl } from '@/composables/useMediaControl'
import { useVideoStream } from '@/composables/useVideoStream'
import Toolbar from '@/components/Toolbar/Toolbar.vue'
import Header from '@/components/Header/Header.vue'
import Sidebar from '@/components/Sidebar/Sidebar.vue'
import CommonSettings from '@/components/Common/CommonSettings.vue'
import DataListModal from '@/components/Modals/DataListModal.vue'
import AuthModal from '@/components/Auth/AuthModal.vue'
import Viewer from '@/components/Viewer/Viewer.vue'
import Joystick from '@/components/Control/Joystick.vue'
import MediaControl from '@/components/Control/MediaControl.vue'
import VideoDisplay from '@/components/Control/VideoDisplay.vue'

// 布局相关状态
const openSidebar = ref(false)
const openCommonSettings = ref(false)
const openDataListModal = ref(false)
const openAuthModal = ref(false)
const videoVisible = ref(true)

// 摇杆显示状态
const joystickMode = ref(0) // 0-3循环状态
const joystickShowStatus = ref(false) // 控制showStatus属性
const joysticksVisible = ref(true) // 控制摇杆容器显示

// 视频相关状态
const videoSrc = ref('')
const isVideoConnected = ref(false)

// 初始化 composables
const { sendMove, sendStop, connect: connectRobot } = useRobotControl()
const { isRecording, capture, startRecord, stopRecord, setRecordingState } = useMediaControl()
const { refresh: refreshVideo, setConnected: setVideoConnected } = useVideoStream()

// 摇杆显示状态切换处理
function handleJoystickStateChange(state) {
  joystickMode.value = state
  switch (state) {
    case 0: // 默认：显示摇杆，不显示状态
      joysticksVisible.value = true
      joystickShowStatus.value = false
      break
    case 1: // 显示摇杆和状态
      joysticksVisible.value = true
      joystickShowStatus.value = true
      break
    case 2: // 隐藏摇杆
      joysticksVisible.value = false
      joystickShowStatus.value = false
      break
  }
}

// 摇杆事件处理
function handleLeftJoystickMove(direction) {
  sendMove(direction)
}

function handleLeftJoystickStop() {
  sendStop('left')
}

function handleRightJoystickMove(direction) {
  sendMove(direction)
}

function handleRightJoystickStop() {
  sendStop('right')
}

// 媒体控制事件处理
async function handleCameraClick() {
  await capture()
}

async function handleRecorderClick(active) {
  if (active) {
    await startRecord()
  } else {
    await stopRecord()
  }
}

// 视频事件处理
function handleVideoRefresh() {
  refreshVideo()
}

function handleVideoFullscreen() {
  // 全屏逻辑
}

// 布局控制
function handleOpenCommonSettings(value) {
  if (value) {
    openSidebar.value = false
    openDataListModal.value = false
    openAuthModal.value = false
  }
  openCommonSettings.value = value
}

function handleOpenDataListModal(value) {
  if (value) {
    openSidebar.value = false
    openCommonSettings.value = false
    openAuthModal.value = false
  }
  openDataListModal.value = value
}

function handleOpenAuthModal(value) {
  if (value) {
    openSidebar.value = false
    openCommonSettings.value = false
    openDataListModal.value = false
  }
  openAuthModal.value = value
}

function handleToggleSidebar() {
  const newValue = !openSidebar.value
  if (newValue) {
    openCommonSettings.value = false
    openDataListModal.value = false
    openAuthModal.value = false
  }
  openSidebar.value = newValue
}

function handleVideoVisibleChange(visible) {
  videoVisible.value = visible
}

onMounted(() => {
  // 连接机器人控制
  connectRobot()
})
</script>

<style scoped>
.home-page {
  width: 100vw;
  height: 100vh;
  position: relative;
}

.control-panel {
  position: absolute;
  z-index: 100;
}

/* 视频显示区域 - 左上角，避开StatsGl */
/* 适配修改 */
.video-panel {
  top: 40px;
  left: 10px;
  width: 300px;
}

/* 左下角Joystick */
/* 适配修改 */
.joystick-left {
  bottom: 10px;
  left: 20px;
}

/* 右下角Joystick */
/* 适配修改 */
.joystick-right {
  bottom: 10px;
  right: 20px;
}

/* 右侧媒体控制 */
.media-panel {
  top: 50%;
  right: 20px;
  transform: translateY(-50%);
}

/* 响应式设计 */
@media screen and (max-width: 768px) {
  .video-panel {
    top: 100px;
    left: 105px;
    width: 360px;
  }

  .joystick-left {
    bottom: 12px;
    left: 12px;
  }

  .joystick-right {
    bottom: 12px;
    right: 12px;
  }

  .media-panel {
    right: 12px;
  }
}

@media screen and (max-width: 480px) {
  .video-panel {
    top: 100px;
    left: 70px;
    width: 240px;
  }

  .joystick-left {
    bottom: 8px;
    left: 8px;
  }

  .joystick-right {
    bottom: 8px;
    right: 8px;
  }

  .media-panel {
    right: 8px;
  }
}

@media screen and (min-width: 1441px) {
  .video-panel {
    top: 120px;
    left: 170px;
    width: 600px;
  }

  .joystick-left {
    bottom: 24px;
    left: 24px;
  }

  .joystick-right {
    bottom: 24px;
    right: 24px;
  }

  .media-panel {
    right: 24px;
  }
}
</style>