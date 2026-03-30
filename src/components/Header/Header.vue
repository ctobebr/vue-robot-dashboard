<template>
  <div class="header">
    <div class="header-left">
      <el-popover
        v-model:visible="statusPopoverVisible"
        placement="bottom-start"
        :width="200"
        trigger="click"
      >
        <template #reference>
          <div class="status-badge">
            <div class="status-icons">
              <div :style="{ color: netColor, fontSize: '18px', display: 'flex', alignItems: 'center' }">
                <PhWifiHigh size="18" weight="bold" :color="netColor" />
              </div>
              <div
                class="status-icon-container"
                :class="{ 'rotating': status === 'mapping' }"
              >
                <PhTarget size="18" :color="status === 'mapping' ? '#10b981' : '#6b7280'" />
              </div>
              <div
                class="status-icon-container"
                :class="{ 'rotating': recording }"
              >
                <PhVinylRecord size="18" :color="recording ? '#10b981' : '#6b7280'" />
              </div>
              <PhCaretDown size="10" />
            </div>
          </div>
        </template>
        <div class="status-popover">
          <div class="status-item">
            <span>{{ t('networkStatus') }}</span>
            <span
              class="status-dot"
              :style="{ backgroundColor: status !== 'offline' ? '#10b981' : '#6b7280' }"
            />
          </div>
          <div class="status-item">
            <span>{{ t('mappingStatus') }}</span>
            <span
              class="status-dot"
              :style="{ backgroundColor: status === 'mapping' ? '#10b981' : '#6b7280' }"
            />
          </div>
          <div class="status-item">
            <span>{{ t('recordingStatus') }}</span>
            <span
              class="status-dot"
              :style="{ backgroundColor: recording ? '#10b981' : '#6b7280' }"
            />
          </div>
        </div>
      </el-popover>
    </div>

    <div class="header-center">
      <div class="usage-item">
        <el-progress
          type="circle"
          :percentage="usage.cpu"
          :width="22"
          :stroke-width="2"
          :color="getUsageColor(usage.cpu)"
          :show-text="false"
        />
        <span class="usage-label">{{ t('cpu') }}</span>
      </div>
      <div class="usage-item">
        <el-progress
          type="circle"
          :percentage="usage.memory"
          :width="22"
          :stroke-width="2"
          :color="getUsageColor(usage.memory)"
          :show-text="false"
        />
        <span class="usage-label">{{ t('memory') }}</span>
      </div>
      <div class="usage-item">
        <el-progress
          type="circle"
          :percentage="usage.disk"
          :width="22"
          :stroke-width="2"
          :color="getUsageColor(usage.disk)"
          :show-text="false"
        />
        <span class="usage-label">{{ t('disk') }}</span>
      </div>
    </div>

    <div class="header-right">
      <div class="icon-button" @click="handleToggleLanguage" :title="t('toggleLanguage')">
        <PhTranslate color="#ffffff" size="18" />
      </div>
      <!-- 注释网络设置功能 -->
      <!-- <div class="icon-button" @click="handleOpenNetworkModal" :title="t('networkSettings')">
        <PhShareNetwork color="#ffffff" size="18" />
      </div> -->
      <div class="icon-button" @click="handleToggleSidebar" :title="t('moreSettings')">
        <PhList color="#ffffff" size="20" />
      </div>
      <el-button
        :type="recording ? 'success' : 'primary'"
        size="default"
        class="header-action-btn recording-btn"
        @click="handleRecordingClick"
      >
        <template #icon>
          <PhPower v-if="recording" size="18" />
          <PhPlay v-else size="18" weight="fill" />
        </template>
        <span class="btn-text">{{ recording ? `${t('stopRecording')} (${formatSecondsToMinutes(recordingTime)})` : t('startRecording') }}</span>
      </el-button>
      <el-button
        type="warning"
        size="default"
        class="header-action-btn reset-btn"
        @click="handleOpenResetMappingModal"
      >
        <template #icon>
          <PhArrowClockwise size="18" />
        </template>
        <span class="btn-text">{{ t('resetMapping') }}</span>
      </el-button>
    </div>

    <el-dialog
      v-model="recordingDialogVisible"
      :title="t('enterRecordedPacketName')"
      width="500px"
      centered
      append-to-body
    >
      <el-input
        :label="t('dataPacketName')"
        v-model="dataName"
        :placeholder="defaultDataName"
      />
      <template #footer>
        <el-button @click="recordingDialogVisible = false">{{ t('cancel') }}</el-button>
        <el-button type="primary" @click="handleConfirmRecording">{{ t('confirm') }}</el-button>
      </template>
    </el-dialog>

    <el-dialog
      v-model="resetMappingDialogVisible"
      :title="t('resetMapBuilding')"
      width="500px"
      centered
      append-to-body
    >
      <p>{{ t('resetMapBuildingConfirm') }}</p>
      <template #footer>
        <el-button @click="resetMappingDialogVisible = false">{{ t('cancel') }}</el-button>
        <el-button type="primary" @click="handleConfirmResetMapping">{{ t('confirm') }}</el-button>
      </template>
    </el-dialog>

    <el-dialog
      v-model="networkDialogVisible"
      width="560px"
      centered
      append-to-body
    >
      <template #header>
        <div class="network-dialog-header">
          <span>{{ t('enterNetworkInfo') }}</span>
          <el-tooltip :content="t('networkInfoTooltip')" placement="top">
            <PhInfo size="14" />
          </el-tooltip>
        </div>
      </template>
      <div class="network-dialog-content">
        <div class="network-row">
          <div class="network-label">IP：</div>
          <div class="network-input">
            <IpInput v-model="networksValue.ip" />
          </div>
        </div>
        <div class="network-buttons">
          <el-button @click="handleConfirmNetworkChange">{{ t('confirm') }}</el-button>
          <el-button @click="handleInitializeNetwork">{{ t('initialize') }}</el-button>
        </div>
      </div>
    </el-dialog>

    <el-dialog
      v-model="changeIpDialogVisible"
      :title="t('modifyThisIp')"
      width="500px"
      centered
      append-to-body
    >
      <div class="change-ip-content">
        <div class="change-ip-message">
          {{ changeIpData.type === 1 ? t('ipWillBeChangedTo') + changeIpData.ip : t('ipWillBeResetTo') + '192.168.1.251' }}
        </div>
        <div class="change-ip-buttons">
          <el-button type="primary" @click="handleConfirmChangeIp">{{ t('confirm') }}</el-button>
          <el-button @click="changeIpDialogVisible = false">{{ t('cancel') }}</el-button>
        </div>
      </div>
    </el-dialog>
  </div>
</template>

<script setup>
import { ref, computed, onMounted, onUnmounted, watchEffect } from 'vue'
import { useI18n } from 'vue-i18n'
import { useDeviceStore } from '@/stores/device'
import { useSocket } from '@/composables/useSocket'
import { ElNotification } from 'element-plus'
import dayjs from 'dayjs'
import duration from 'dayjs/plugin/duration'
import { deviceAPI } from '@/services/api'
import { PhWifiHigh, PhTarget, PhVinylRecord, PhCaretDown, PhTranslate, PhShareNetwork, PhList, PhPower, PhPlay, PhArrowClockwise, PhInfo } from '@phosphor-icons/vue'
import IpInput from '@/components/Input/IpInput.vue'

dayjs.extend(duration)

defineProps({
  openSidebar: Boolean
})
const emit = defineEmits(['toggle-sidebar'])

const { t, locale } = useI18n()
const deviceStore = useDeviceStore()
const { socket } = useSocket()

const recordingDialogVisible = ref(false)
const resetMappingDialogVisible = ref(false)
const statusPopoverVisible = ref(false)
const dataName = ref('')
const networkDialogVisible = ref(false)
const changeIpDialogVisible = ref(false)

const networksValue = ref({
  ip: deviceStore.networks.ip,
  gw: deviceStore.networks.gw,
  netMask: deviceStore.networks.netMask
})

const changeIpData = ref({
  ip: '',
  type: 1
})

const status = computed(() => deviceStore.status)
const recording = computed(() => deviceStore.recording)
const recordingTime = computed(() => deviceStore.recordingTime)
const usage = computed(() => deviceStore.usage)
const networks = computed(() => deviceStore.networks)

const defaultDataName = dayjs().format('YYYYMMDDHHmmss')

const netColor = computed(() => {
  if (status.value !== 'offline') {
    return '#10b981'
  }
  return '#6b7280'
})

function getUsageColor(value) {
  if (value < 50) {
    return '#22c55e'
  } else if (value < 75) {
    return '#eab308'
  } else {
    return '#ef4444'
  }
}

function formatSecondsToMinutes(seconds) {
  const formattedDuration = dayjs.duration(seconds, 'seconds')
  const minutes = formattedDuration.minutes()
  const remainingSeconds = formattedDuration.seconds()
  return `${minutes}:${remainingSeconds < 10 ? '0' : ''}${remainingSeconds}`
}

function handleToggleLanguage() {
  const newLang = locale.value === 'zh' ? 'en' : 'zh'
  locale.value = newLang
  localStorage.setItem('lang', newLang)
}

function handleRecordingClick() {
  if (recording.value) {
    handleStopRecording()
  } else {
    handleOpenRecordingModal()
  }
}

function handleOpenRecordingModal() {
  dataName.value = defaultDataName
  recordingDialogVisible.value = true
}

async function handleStopRecording() {
  try {
    await deviceStore.stopRecording()
  } catch (error) {
    ElNotification({
      title: t('error'),
      message: error.message || t('unknownError'),
      type: 'error',
      duration: 5000
    })
  }
}

function handleOpenResetMappingModal() {
  resetMappingDialogVisible.value = true
}

function handleToggleSidebar() {
  emit('toggle-sidebar')
}

async function handleConfirmRecording() {
  const finalDataName = dataName.value ? `${defaultDataName}_${dataName.value}` : defaultDataName
  try {
    const response = await deviceAPI.getDataDetails()
    const data = response.data.data
    const repetitiveName = data.every((item) => item.name !== finalDataName)

    if (!repetitiveName) {
      ElNotification({
        title: t('dataPacketNameDuplicate'),
        message: t('dataPacketNameDuplicateMessage'),
        type: 'error',
        duration: 5000
      })
    } else {
      await deviceStore.startRecording(finalDataName)
      recordingDialogVisible.value = false
    }
  } catch (error) {
    ElNotification({
      title: t('error'),
      message: error.message || t('unknownError'),
      type: 'error',
      duration: 5000
    })
  }
}

async function handleConfirmResetMapping() {
  try {
    await deviceStore.resetMapping()
    resetMappingDialogVisible.value = false
    window.location.reload()
  } catch (error) {
    ElNotification({
      title: t('error'),
      message: error.message || t('unknownError'),
      type: 'error',
      duration: 5000
    })
  }
}

function handleOpenNetworkModal() {
  networksValue.value = {
    ip: networks.value.ip,
    gw: networks.value.gw,
    netMask: networks.value.netMask
  }
  networkDialogVisible.value = true
}

function validateIpAddress(ip) {
  const segments = ip.split('.')
  if (segments.length !== 4) {
    return false
  }

  for (let i = 0; i < segments.length; i++) {
    const num = parseInt(segments[i], 10)
    if (isNaN(num)) {
      return false
    }

    if (i < 3) {
      if (num < 0 || num > 255) {
        return false
      }
    } else {
      if (num < 2 || num > 254) {
        return false
      }
    }
  }

  return true
}

function handleConfirmNetworkChange() {
  if (!validateIpAddress(networksValue.value.ip)) {
    ElNotification({
      title: t('ipValidationError'),
      message: t('ipValidationErrorMessage'),
      type: 'error',
      duration: 5000
    })
    return
  }
  changeIpData.value = {
    ip: networksValue.value.ip,
    type: 1
  }
  changeIpDialogVisible.value = true
}

function handleInitializeNetwork() {
  changeIpData.value = {
    ip: '192.168.1.251',
    type: 2
  }
  changeIpDialogVisible.value = true
}

async function handleConfirmChangeIp() {
  try {
    const ipSegments = changeIpData.value.ip.split('.')
    const newGw = `${ipSegments[0]}.${ipSegments[1]}.${ipSegments[2]}.1`
    const newNetworks = {
      ip: changeIpData.value.ip,
      gw: newGw,
      netMask: '255.255.255.0',
      type: changeIpData.value.type
    }
    
    await deviceStore.updateNetworks(newNetworks)
    changeIpDialogVisible.value = false
    networkDialogVisible.value = false
  } catch (error) {
    ElNotification({
      title: t('error'),
      message: error.message || t('unknownError'),
      type: 'error',
      duration: 5000
    })
  }
}

onMounted(() => {
  if (socket.value) {
    socket.value.on('ChangeLidarIpAck', (msg) => {
      if (msg.ackCode === 1) {
        ElNotification({
          title: t('ipUpdateSuccess'),
          message: t('ipUpdateSuccessMessage'),
          type: 'success',
          duration: 5000
        })
      } else if (msg.ackCode === -1) {
        ElNotification({
          title: t('ipUpdateFailed'),
          message: t('ipUpdateFailedMessage'),
          type: 'error',
          duration: 5000
        })
      }
    })
  }
})

onUnmounted(() => {
  if (socket.value) {
    socket.value.off('ChangeLidarIpAck')
  }
})
</script>

<style scoped>
.network-dialog-header {
  display: flex;
  align-items: center;
  gap: 8px;
}

.network-dialog-content {
  padding: 10px 0;
}

.network-row {
  display: flex;
  flex-direction: row;
  align-items: center;
  justify-content: space-evenly;
}

.network-label {
  margin-right: 10px;
  width: 30%;
  text-align: center;
}

.network-input {
  width: 70%;
}

.network-buttons {
  display: flex;
  flex-direction: row;
  justify-content: space-around;
  margin-top: 20px;
}

.change-ip-content {
  display: flex;
  flex-direction: column;
  align-items: center;
}

.change-ip-message {
  width: 100%;
  text-align: center;
}

.change-ip-buttons {
  display: flex;
  flex-direction: row;
  justify-content: space-around;
  margin-top: 20px;
  width: 100%;
}
</style>

<style scoped>
.header {
  position: absolute;
  display: flex;
  align-items: center;
  z-index: 100;
  width: 100%;
  height: var(--header-height, 40px);
  top: 0;
  left: 0;
  justify-content: space-between;
  background-color: #141414;
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.3);
  padding: 0 var(--base-spacing, 20px);
  user-select: none;
}

.header-left {
  display: flex;
  align-items: center;
  gap: 12px;
  width: 180px;
}

.header-center {
  display: flex;
  align-items: center;
  gap: 6px;
}

.header-right {
  display: flex;
  align-items: center;
  gap: 12px;
}

.usage-item {
  display: flex;
  align-items: center;
  gap: 6px;
}

.usage-label {
  font-size: var(--base-font-size, 14px);
  color: #9ca3af;
  font-weight: 500;
}

.status-badge {
  background: rgba(255, 255, 255, 0.1);
  border-radius: 4px;
  padding: 4px 12px;
  cursor: pointer;
}

.status-icons {
  display: flex;
  align-items: center;
  gap: 8px;
}

.status-icon-container {
  display: flex;
  justify-content: center;
  align-items: center;
}

.status-icon-container.rotating {
  animation: rotate 2s linear infinite;
}

@keyframes rotate {
  from {
    transform: rotate(0deg);
  }
  to {
    transform: rotate(360deg);
  }
}

.icon-button {
  padding: 8px;
  display: flex;
  justify-content: center;
  align-items: center;
  color: #ffffff;
  opacity: 0.8;
  cursor: pointer;
  transition: opacity 0.2s;
  font-size: var(--icon-size-md, 18px);
}

.icon-button:hover {
  opacity: 1;
}

.status-popover {
  display: flex;
  flex-direction: column;
  gap: 4px;
}

.status-item {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 8px;
}

.status-item span:first-child {
  font-size: var(--base-font-size, 14px);
  color: #9ca3af;
}

.status-dot {
  width: 10px;
  height: 10px;
  border-radius: 50%;
}

.header-action-btn {
  height: var(--button-height, 32px);
  padding: 0 12px;
  font-size: var(--base-font-size, 14px);
  font-weight: 500;
  border-radius: 6px;
  transition: all 0.2s ease;
  border: none;
}

.header-action-btn:hover {
  transform: translateY(-1px);
  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.3);
}

.recording-btn {
  background: rgba(59, 130, 246, 0.15);
  color: #3b82f6;
}

.recording-btn:hover {
  background: rgba(59, 130, 246, 0.25);
}

.recording-btn.el-button--success {
  background: rgba(16, 185, 129, 0.15);
  color: #10b981;
}

.recording-btn.el-button--success:hover {
  background: rgba(16, 185, 129, 0.25);
}

.reset-btn {
  background: rgba(245, 158, 11, 0.15);
  color: #f59e0b;
}

.reset-btn:hover {
  background: rgba(245, 158, 11, 0.25);
}

.btn-text {
  margin-left: 6px;
}

/* Responsive adjustments for Header */
@media screen and (max-width: 768px) {
  .header {
    padding: 0 12px;
  }

  .header-left {
    width: auto;
  }

  .header-center {
    display: none;
  }

  .header-right {
    gap: 8px;
  }

  .icon-button {
    padding: 6px;
  }

  .header-action-btn {
    padding: 0 8px;
  }
}

@media screen and (min-width: 769px) and (max-width: 1024px) {
  .header {
    padding: 0 16px;
  }
}
</style>
