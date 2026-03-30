<template>
  <div class="home-page">
    <Toolbar 
      :openCommonSettings="openCommonSettings"
      :openDataListModal="openDataListModal"
      @update:openCommonSettings="handleOpenCommonSettings"
      @update:openDataListModal="handleOpenDataListModal"
    />
    <Header 
      :openSidebar="openSidebar" 
      @toggle-sidebar="handleToggleSidebar" 
    />
    <Sidebar :opened="openSidebar" @close="openSidebar = false" />
    <CommonSettings :opened="openCommonSettings" @close="openCommonSettings = false" />
    <DataListModal :opened="openDataListModal" @close="openDataListModal = false" />
    <Viewer />
    
    <!-- 视频显示区域 -->
    <div class="control-panel video-panel">
      <VideoDisplay 
        :videoSrc="videoSrc"
        :isConnected="isVideoConnected"
        @refresh="handleVideoRefresh"
        @fullscreen="handleVideoFullscreen"
      />
    </div>
    
    <!-- 左下角Joystick -->
    <div class="control-panel joystick-left">
      <Joystick 
        :size="120"
        color="#409eff"
        @move="handleLeftJoystickMove"
        @stop="handleLeftJoystickStop"
      />
    </div>
    
    <!-- 右下角Joystick -->
    <div class="control-panel joystick-right">
      <Joystick 
        :size="120"
        color="#67c23a"
        @move="handleRightJoystickMove"
        @stop="handleRightJoystickStop"
      />
    </div>
    
    <!-- 右侧媒体控制 -->
    <div class="control-panel media-panel">
      <MediaControl 
        @camera-click="handleCameraClick"
        @recorder-click="handleRecorderClick"
      />
    </div>
  </div>
</template>

<script setup>
import { ref, onMounted, onUnmounted } from 'vue'
import axios from 'axios'
import { useDeviceStore } from '@/stores/device'
import { useSocket } from '@/composables/useSocket'
import Toolbar from '@/components/Toolbar/Toolbar.vue'
import Header from '@/components/Header/Header.vue'
import Sidebar from '@/components/Sidebar/Sidebar.vue'
import CommonSettings from '@/components/Common/CommonSettings.vue'
import DataListModal from '@/components/Modals/DataListModal.vue'
import Viewer from '@/components/Viewer/Viewer.vue'
import Joystick from '@/components/Control/Joystick.vue'
import MediaControl from '@/components/Control/MediaControl.vue'
import VideoDisplay from '@/components/Control/VideoDisplay.vue'

const openSidebar = ref(false)
const openCommonSettings = ref(false)
const openDataListModal = ref(false)

// 视频相关状态
const videoSrc = ref('')
const isVideoConnected = ref(false)

// 控制相关事件处理
function handleLeftJoystickMove(direction) {
  console.log('Left joystick move:', direction)
  // 这里可以添加与后端通信的逻辑
}

function handleLeftJoystickStop() {
  console.log('Left joystick stop')
  // 这里可以添加与后端通信的逻辑
}

function handleRightJoystickMove(direction) {
  console.log('Right joystick move:', direction)
  // 这里可以添加与后端通信的逻辑
}

function handleRightJoystickStop() {
  console.log('Right joystick stop')
  // 这里可以添加与后端通信的逻辑
}

function handleCameraClick(active) {
  console.log('Camera clicked:', active)
  // 这里可以添加与后端通信的逻辑
}

function handleRecorderClick(active) {
  console.log('Recorder clicked:', active)
  // 这里可以添加与后端通信的逻辑
}

function handleVideoRefresh() {
  console.log('Video refresh')
  // 这里可以添加与后端通信的逻辑
}

function handleVideoFullscreen() {
  console.log('Video fullscreen')
  // 这里可以添加全屏逻辑
}

// 处理打开常用设置 - 关闭其他组件
function handleOpenCommonSettings(value) {
  if (value) {
    openSidebar.value = false
    openDataListModal.value = false
  }
  openCommonSettings.value = value
}

// 处理打开数据列表 - 关闭其他组件
function handleOpenDataListModal(value) {
  if (value) {
    openSidebar.value = false
    openCommonSettings.value = false
  }
  openDataListModal.value = value
}

// 处理切换侧边栏 - 关闭其他组件
function handleToggleSidebar() {
  const newValue = !openSidebar.value
  if (newValue) {
    openCommonSettings.value = false
    openDataListModal.value = false
  }
  openSidebar.value = newValue
}

const deviceStore = useDeviceStore()
const { socket } = useSocket()

let timer = null
let intervalId = null

const shouldExecuteMapping = ref(false)

function mappingStart() {
  if (shouldExecuteMapping.value) {
    return axios.post(
      `http://${window.location.hostname}:8000/api/devices/${
        import.meta.env.VITE_DEVICE_SN
      }/mapping_start`
    ).then((response) => response.data)
    .catch((error) => {
      console.error('POST请求出错:', error)
      throw error
    })
  }
}

function debounce(func, delay) {
  let timeoutId
  return function(...args) {
    clearTimeout(timeoutId)
    timeoutId = setTimeout(() => func.apply(this, args), delay)
  }
}

let tag = 0
let timeoutId = null

let baseStatusListener = null
let recordStatusListener = null
let disconnectListener = null

onMounted(() => {
  if (socket.value) {
    intervalId = setInterval(() => {
      debounce(mappingStart, 1000)()
    }, 5000)

    baseStatusListener = (msg) => {
      const { cpuUsage, diskUsage, memoryUsage, navigationStatus } = msg

      if (timer) clearTimeout(timer)
      timer = setTimeout(() => {
        deviceStore.setStatus('offline')
        deviceStore.setRecording(false)
      }, 5000)

      if (tag === 5) {
        if (navigationStatus === 1) {
          if (timeoutId) clearTimeout(timeoutId)
          shouldExecuteMapping.value = false
          deviceStore.setStatus('mapping')
        } else {
          deviceStore.setStatus('online')
          shouldExecuteMapping.value = true
        }
        deviceStore.setUsage({
          cpu: cpuUsage,
          disk: diskUsage,
          memory: memoryUsage
        })
        tag = 0
      }
      tag++
    }

    recordStatusListener = (msg) => {
      const { value } = msg
      deviceStore.setRecording(value === 1)
    }

    disconnectListener = () => {
      deviceStore.setStatus('offline')
      deviceStore.setUsage({
        cpu: 0,
        disk: 0,
        memory: 0
      })
    }

    socket.value.on('BaseStatus', baseStatusListener)
    socket.value.on('RecordStatus', recordStatusListener)
    socket.value.on('disconnect', disconnectListener)
  }
})

onUnmounted(() => {
  if (intervalId) clearInterval(intervalId)
  if (timer) clearTimeout(timer)
  if (socket.value) {
    if (baseStatusListener) socket.value.off('BaseStatus', baseStatusListener)
    if (recordStatusListener) socket.value.off('RecordStatus', recordStatusListener)
    if (disconnectListener) socket.value.off('disconnect', disconnectListener)
  }
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
.video-panel {
  top: 120px;
  left: 140px;
  width: 480px;
}

/* 左下角Joystick */
.joystick-left {
  bottom: 20px;
  left: 20px;
}

/* 右下角Joystick */
.joystick-right {
  bottom: 20px;
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
