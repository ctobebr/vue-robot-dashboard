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

    <div class="device-list">
      <div
        v-for="device in devices"
        :key="device.id"
        class="device-item"
        :class="{ selected: selectedDevice?.id === device.id }"
        @click="selectDevice(device)"
      >
        <el-checkbox
          v-model="device.selected"
          :disabled="true"
          class="device-checkbox"
        />
        <span class="device-name">{{ device.name }}</span>
      </div>
    </div>

    <div class="device-footer">
      <el-button
        type="primary"
        class="confirm-btn"
        :disabled="!selectedDevice"
        @click="confirmSelection"
      >
        {{ t('confirmSelect') }}
      </el-button>
    </div>
  </div>
</template>

<script setup>
import { ref, computed } from 'vue'
import { useI18n } from 'vue-i18n'
import { PhList, PhPower } from '@phosphor-icons/vue'

const { t } = useI18n()

const emit = defineEmits(['select', 'logout'])

const devices = ref([
  { id: '1', name: 'robot-alpha', selected: false },
  { id: '2', name: 'robot-beta', selected: false },
  { id: '3', name: 'robot-gamma', selected: false }
])

const selectedDevice = computed(() => {
  return devices.value.find(d => d.selected)
})

function selectDevice(device) {
  devices.value.forEach(d => {
    d.selected = d.id === device.id
  })
}

function confirmSelection() {
  if (selectedDevice.value) {
    emit('select', selectedDevice.value)
  }
}

function handleLogout() {
  emit('logout')
}
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

.device-list {
  flex: 1;
  padding: 20px;
  overflow-y: auto;
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

.device-checkbox {
  flex-shrink: 0;
}

.device-name {
  font-size: 14px;
  color: #ffffff;
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
