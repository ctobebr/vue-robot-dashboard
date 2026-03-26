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

const openSidebar = ref(false)
const openCommonSettings = ref(false)
const openDataListModal = ref(false)

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
</style>
