<template>
  <div class="device-choice">
    <div class="device-header">
      <div class="header-title">
        <PhList color="#409eff" size="18" />
        <span>{{ t('deviceList') }}</span>
        <span class="device-count">{{ devices.length }}{{ t('items') }}</span>
      </div>
      <div class="header-actions">
        <div class="logout-btn" @click="handleLogout" :title="t('logout')">
          <PhPower color="#999999" size="16" />
        </div>
      </div>
    </div>

    <!-- 连接状态显示 -->
    <div v-if="connectedDevice" class="connection-status connected">
      <div class="status-info">
        <span class="status-dot connected"></span>
        <span class="status-text">{{ t('connectedDevice') }}: {{ connectedDevice.name }}</span>
      </div>
      <el-button type="danger" size="small" @click="disconnectDevice">
        {{ t('disconnect') }}
      </el-button>
    </div>
    
    <!-- 连接中状态 -->
    <div v-else-if="isConnecting" class="connection-status connecting">
      <div class="status-info">
        <span class="status-dot connecting"></span>
        <span class="status-text">{{ t('connecting') }}...</span>
      </div>
      <el-button type="info" size="small" disabled>
        {{ t('connecting') }}
      </el-button>
    </div>
    
    <!-- 连接错误状态 -->
    <div v-else-if="connectionError" class="connection-status error">
      <div class="status-info">
        <span class="status-dot error"></span>
        <span class="status-text">{{ t('connectionFailed') }}: {{ connectionError }}</span>
      </div>
      <el-button type="primary" size="small" @click="confirmSelection">
        {{ t('retry') }}
      </el-button>
    </div>

    <div class="device-list">
      <div v-if="loading" class="loading-state">
        <el-icon class="loading-icon"><Loading /></el-icon>
        <span>{{ t('loading') }}</span>
      </div>
      <div v-else-if="devices.length === 0" class="empty-state">
        <PhRobot color="#666666" size="48" />
        <span>{{ t('noDevices') }}</span>
      </div>
      <template v-else>
        <div
          v-for="device in devices"
          :key="device.id"
          class="device-item"
          :class="{ 
            selected: selectedDevice?.id === device.id,
            connected: connectedDevice?.id === device.id
          }"
          @click="selectDevice(device)"
        >
          <el-checkbox
            v-model="device.selected"
            :disabled="connectedDevice?.id === device.id"
            class="device-checkbox"
          />
          <span class="device-name">{{ device.name }}</span>
          <span v-if="connectedDevice?.id === device.id" class="connected-badge">
            {{ t('connected') }}
          </span>
        </div>
      </template>
    </div>

    <div class="device-footer">
      <el-button
        v-if="!connectedDevice && !isConnecting"
        type="primary"
        class="confirm-btn"
        :disabled="!selectedDevice || !!connectionError"
        @click="confirmSelection"
      >
        {{ connectionError ? t('retry') : t('confirmSelect') }}
      </el-button>
      <el-button
        v-else-if="isConnecting"
        type="info"
        class="confirm-btn"
        loading
      >
        {{ t('connecting') }}
      </el-button>
      <el-button
        v-else
        type="danger"
        class="confirm-btn"
        @click="disconnectDevice"
      >
        {{ t('disconnect') }}
      </el-button>
    </div>

    <!-- API 测试面板 -->
    <ApiTestPanel />
  </div>
</template>

<script setup>
import { ref, computed, onMounted, watch } from 'vue'
import { useI18n } from 'vue-i18n'
import { PhList, PhPower, PhRobot } from '@phosphor-icons/vue'
import { Loading } from '@element-plus/icons-vue'
import ApiTestPanel from './ApiTestPanel.vue'
import { deviceAPI } from '@/services/api'
import { useSocket } from '@/composables/useSocket'
import { useDeviceStore } from '@/stores/device'

const { t } = useI18n()
const { initSocket, subscribe, unsubscribe, disconnect, connected, currentDeviceId } = useSocket()
const deviceStore = useDeviceStore()

const emit = defineEmits(['select', 'logout'])

const devices = ref([])
const loading = ref(false)
const connectedDevice = ref(null)
const isConnecting = ref(false)
const connectionError = ref(null)

const selectedDevice = computed(() => {
  return devices.value.find(d => d.selected)
})

// 监听连接状态变化
watch(connected, (isConnected) => {
  if (!isConnected && connectedDevice.value) {
    console.log('[WebSocket] 连接已断开，设备:', connectedDevice.value?.name)
    connectedDevice.value = null
    deviceStore.setSn('')
    deviceStore.setCurrentDevice('')
    isConnecting.value = false
  }
})

async function fetchDevices() {
  loading.value = true
  try {
    const res = await deviceAPI.getAllDevices()
    if (res.data.code === 200) {
      const deviceNames = res.data.data || []
      devices.value = deviceNames.map((name, index) => ({
        id: name,
        name: name,
        selected: false
      }))
    } else {
      devices.value = []
    }
  } catch (error) {
    console.error('获取设备列表失败:', error)
    devices.value = []
  } finally {
    loading.value = false
  }
}

function selectDevice(device) {
  // 如果设备已连接，不能选择/取消
  if (connectedDevice.value?.id === device.id) return
  
  // 如果点击的是已选中的设备，则取消选中
  if (device.selected) {
    device.selected = false
  } else {
    // 先取消所有选中，再选中当前设备
    devices.value.forEach(d => {
      d.selected = d.id === device.id
    })
  }
}

async function confirmSelection() {
  if (!selectedDevice.value) return
  
  const deviceId = selectedDevice.value.id
  isConnecting.value = true
  connectionError.value = null
  
  console.log('[WebSocket] 开始连接设备:', deviceId)
  
  try {
    // 初始化WebSocket连接
    initSocket(deviceId)
    
    // 等待连接成功（最多10秒）
    await new Promise((resolve, reject) => {
      const checkConnection = setInterval(() => {
        if (connected.value) {
          clearInterval(checkConnection)
          clearTimeout(timeoutId)
          resolve()
        }
      }, 100)
      
      const timeoutId = setTimeout(() => {
        clearInterval(checkConnection)
        reject(new Error('连接超时'))
      }, 10000)
    })
    
    console.log('[WebSocket] 连接成功:', deviceId)
    
    // 注意：设备消息订阅在 Viewer.vue 中处理，避免重复订阅
    
    // 设置已连接设备
    connectedDevice.value = selectedDevice.value
    
    // 设置当前设备到 store（用于摇杆控制）
    deviceStore.setCurrentDevice(deviceId)
    deviceStore.setSn(deviceId)
    
    // 清除选择状态
    devices.value.forEach(d => d.selected = false)
    
    // 通知父组件设备已选择
    emit('select', connectedDevice.value)
    
    console.log('[WebSocket] 设备连接完成:', deviceId)
    
  } catch (error) {
    console.error('[WebSocket] 连接失败:', error.message)
    connectionError.value = error.message
    deviceStore.setSn('')
    deviceStore.setCurrentDevice('')
  } finally {
    isConnecting.value = false
  }
}

function disconnectDevice() {
  if (!connectedDevice.value) return
  
  const deviceId = connectedDevice.value.id
  
  // 注意：取消订阅在 Viewer.vue 中处理
  
  // 清除状态
  connectedDevice.value = null
  deviceStore.setSn('')
  deviceStore.setCurrentDevice('')
  
  // 清除选择
  devices.value.forEach(d => d.selected = false)
}

function handleLogout() {
  // 断开设备连接
  if (connectedDevice.value) {
    disconnectDevice()
  }
  emit('logout')
}

onMounted(() => {
  fetchDevices()
})
</script>

<style scoped>
.device-choice {
  height: 100%;
  display: flex;
  flex-direction: column;
}

.device-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 16px 20px;
  border-bottom: 1px solid rgba(255, 255, 255, 0.1);
}

.header-title {
  display: flex;
  align-items: center;
  gap: 8px;
  font-size: 16px;
  font-weight: 600;
  color: #ffffff;
}

.device-count {
  padding: 2px 8px;
  background-color: rgba(255, 255, 255, 0.1);
  border-radius: 10px;
  font-size: 12px;
  color: #999999;
}

.header-actions {
  display: flex;
  gap: 8px;
}

.logout-btn {
  width: 28px;
  height: 28px;
  border-radius: 4px;
  display: flex;
  align-items: center;
  justify-content: center;
  cursor: pointer;
  transition: all 0.2s ease;
  opacity: 0.7;
}

.logout-btn:hover {
  opacity: 1;
  background-color: rgba(231, 76, 60, 0.2);
}

/* 连接状态栏 */
.connection-status {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 12px 20px;
  background-color: rgba(16, 185, 129, 0.1);
  border-bottom: 1px solid rgba(16, 185, 129, 0.2);
}

.status-info {
  display: flex;
  align-items: center;
  gap: 8px;
}

.status-dot {
  width: 8px;
  height: 8px;
  border-radius: 50%;
}

.status-dot.connected {
  background-color: #10b981;
}

.status-dot.connecting {
  background-color: #f59e0b;
  animation: pulse 1.5s ease-in-out infinite;
}

.status-dot.error {
  background-color: #ef4444;
}

@keyframes pulse {
  0%, 100% {
    opacity: 1;
  }
  50% {
    opacity: 0.5;
  }
}

.status-text {
  color: #10b981;
  font-size: 14px;
}

.connection-status.connecting {
  background-color: rgba(245, 158, 11, 0.1);
  border-bottom: 1px solid rgba(245, 158, 11, 0.2);
}

.connection-status.connecting .status-text {
  color: #f59e0b;
}

.connection-status.error {
  background-color: rgba(239, 68, 68, 0.1);
  border-bottom: 1px solid rgba(239, 68, 68, 0.2);
}

.connection-status.error .status-text {
  color: #ef4444;
}

.device-list {
  flex: 1;
  padding: 20px;
  overflow-y: auto;
}

.loading-state,
.empty-state {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  height: 100%;
  gap: 16px;
  color: #999999;
  font-size: 14px;
}

.loading-icon {
  font-size: 32px;
  animation: rotating 2s linear infinite;
}

@keyframes rotating {
  from {
    transform: rotate(0deg);
  }
  to {
    transform: rotate(360deg);
  }
}

.device-item {
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 12px 16px;
  margin-bottom: 8px;
  background-color: rgba(255, 255, 255, 0.05);
  border-radius: 8px;
  cursor: pointer;
  transition: all 0.2s ease;
}

.device-item:hover {
  background-color: rgba(255, 255, 255, 0.1);
}

.device-item.selected {
  background-color: rgba(64, 158, 255, 0.2);
  border: 1px solid rgba(64, 158, 255, 0.3);
}

.device-item.connected {
  background-color: rgba(16, 185, 129, 0.1);
  border: 1px solid rgba(16, 185, 129, 0.3);
  cursor: not-allowed;
}

.device-checkbox {
  flex-shrink: 0;
}

.device-name {
  flex: 1;
  font-size: 14px;
  color: #ffffff;
}

.connected-badge {
  padding: 2px 8px;
  background-color: rgba(16, 185, 129, 0.2);
  color: #10b981;
  border-radius: 4px;
  font-size: 12px;
}

.device-footer {
  padding: 20px;
  border-top: 1px solid rgba(255, 255, 255, 0.1);
}

.confirm-btn {
  width: 100%;
  height: 40px;
  font-size: 14px;
  border-radius: 8px;
}

.confirm-btn:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}
</style>
