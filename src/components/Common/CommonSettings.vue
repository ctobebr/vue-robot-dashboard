<template>
  <div ref="sidebarRef" class="common-settings-sidebar" :class="{ 'opened': opened, 'closing': isClosing }">
    <div class="sidebar-header">
      <div class="sidebar-title">
        <div class="title-main">3D Viewer</div>
        <div class="title-sub">v4.1.0</div>
      </div>
      <div class="header-actions">
        <el-button 
          link
          size="small"
          @click="toggleFullscreen"
        >
          <PhCornersOut size="16" weight="bold" />
        </el-button>
        <el-popover placement="bottom" :width="150" trigger="click">
          <template #reference>
            <span>
              <el-button link size="small">
                <PhGearFine size="16" weight="bold" />
              </el-button>
            </span>
          </template>
          <div class="popover-menu">
            <div class="popover-item" @click="handleExportConfig">
              <PhShare size="16" />
              <span>{{ t('exportConfig') }}</span>
            </div>
            <div class="popover-item" @click="handleImportConfig">
              <PhDownloadSimple size="16" />
              <span>{{ t('importConfig') }}</span>
            </div>
            <div class="popover-item" @click="handleResetConfig">
              <PhArrowClockwise size="16" />
              <span>{{ t('resetConfig') }}</span>
            </div>
          </div>
        </el-popover>
        <el-button 
          link
          size="small"
          @click="onClose"
        >
          <PhX size="16" weight="bold" />
        </el-button>
      </div>
    </div>

    <div class="sidebar-content">
      <div class="content-section">
        <div class="section-title">{{ t('commonSettings') }}</div>
        <div class="divider"></div>
      </div>

      <el-scrollbar class="settings-scrollbar">
        <el-collapse v-model="activeCollapses">
          <el-collapse-item name="appearance">
            <template #title>
              <span>{{ t('appearance') }}</span>
            </template>
            <div class="settings-group">
              <div class="setting-row">
                <div class="setting-label">{{ t('pointSize') }}</div>
                <div class="setting-control">
                  <el-slider
                    v-model="pointSize"
                    :min="0.1"
                    :max="1"
                    :step="0.1"
                    :format-tooltip="(val) => val.toFixed(1)"
                    size="small"
                  />
                </div>
              </div>
              <div class="setting-row">
                <div class="setting-label">{{ t('opacity') }}</div>
                <div class="setting-control">
                  <el-slider
                    v-model="pointAlpha"
                    :min="0.1"
                    :max="1"
                    :step="0.1"
                    :format-tooltip="(val) => val.toFixed(1)"
                    size="small"
                  />
                </div>
              </div>
              <div class="setting-row">
                <div class="setting-label">{{ t('axes') }}</div>
                <div class="setting-control">
                  <el-segmented
                    v-model="axesVisible"
                    size="small"
                    :options="[{ label: t('open'), value: '1' }, { label: t('close'), value: '0' }]"
                  />
                </div>
              </div>
              <div class="setting-row">
                <div class="setting-label">{{ t('footprint') }}</div>
                <div class="setting-control">
                  <el-segmented
                    v-model="footprintVisible"
                    size="small"
                    :options="[{ label: t('open'), value: '1' }, { label: t('close'), value: '0' }]"
                  />
                </div>
              </div>
              <div class="setting-row">
                <div class="setting-label">{{ t('fov') }}</div>
                <div class="setting-control">
                  <el-slider
                    v-model="cameraFov"
                    :min="40"
                    :max="120"
                    :step="1"
                    :format-tooltip="(val) => val"
                    size="small"
                  />
                </div>
              </div>
            </div>
          </el-collapse-item>

          <el-collapse-item name="filtration">
            <template #title>
              <span>{{ t('filter') }}</span>
            </template>
            <div class="settings-group">
              <div class="setting-row">
                <div class="setting-label">{{ t('heightClipping') }}</div>
                <div class="setting-control">
                  <el-slider
                    v-model="heightClipping"
                    range
                    :min="0"
                    :max="100"
                    :step="0.1"
                    :format-tooltip="(val) => `${val} %`"
                    size="small"
                  />
                </div>
              </div>
              <div class="setting-row">
                <div class="setting-label">{{ t('invertClipping') }}</div>
                <div class="setting-control">
                  <el-segmented
                    v-model="reverseClipping"
                    size="small"
                    :options="[{ label: t('open'), value: '1' }, { label: t('close'), value: '0' }]"
                  />
                </div>
              </div>
              <div class="setting-row">
                <div class="setting-label-with-tooltip">
                  <span>{{ t('collectionMode') }}</span>
                  <el-tooltip :content="t('collectionModeTooltip')" placement="top" effect="dark" popper-class="dark-tooltip">
                    <PhInfo size="12" class="tooltip-icon" />
                  </el-tooltip>
                </div>
                <div class="setting-control">
                  <el-segmented
                    v-model="collectionMode"
                    size="small"
                    :disabled="camera.isFirstPerson"
                    :options="[{ label: t('desktopMode'), value: 'demo' }, { label: t('handheldMode'), value: 'work' }]"
                  />
                </div>
              </div>
            </div>
          </el-collapse-item>
        </el-collapse>
      </el-scrollbar>
    </div>

    <input
      ref="fileInput"
      type="file"
      accept=".json"
      style="display: none"
      @change="handleFileChange"
    />
  </div>
</template>

<script setup>
import { ref, computed, onMounted, watch } from 'vue'
import { useI18n } from 'vue-i18n'
import { useSettingStore } from '@/stores/setting'
import { useClickOutside } from '@/composables/useClickOutside'
import { ElNotification } from 'element-plus'
import { PhCornersOut, PhGearFine, PhX, PhShare, PhDownloadSimple, PhArrowClockwise, PhInfo } from '@phosphor-icons/vue'

const { t } = useI18n()
const settingStore = useSettingStore()

const fileInput = ref(null)
const sidebarRef = ref(null)
const isClosing = ref(false)
const activeCollapses = ref(['appearance', 'filtration'])

const props = defineProps({
  opened: Boolean
})

const emit = defineEmits(['close'])

// 使用点击外部关闭功能
useClickOutside(sidebarRef, null, () => {
  if (props.opened) {
    isClosing.value = true
    setTimeout(() => {
      emit('close')
      isClosing.value = false
    }, 200)
  }
}, computed(() => props.opened))

const appearance = computed(() => settingStore.appearance)
const camera = computed(() => settingStore.camera)

const pointSize = computed({
  get: () => appearance.value.points.size,
  set: (val) => {
    settingStore.setAppearance({
      ...appearance.value,
      points: { ...appearance.value.points, size: val }
    })
  }
})

const pointAlpha = computed({
  get: () => appearance.value.points.alpha,
  set: (val) => {
    settingStore.setAppearance({
      ...appearance.value,
      points: { ...appearance.value.points, alpha: val }
    })
  }
})

const axesVisible = computed({
  get: () => appearance.value.axes.visible ? '1' : '0',
  set: (val) => {
    settingStore.setAppearance({
      ...appearance.value,
      axes: { ...appearance.value.axes, visible: val === '1' }
    })
  }
})

const footprintVisible = computed({
  get: () => appearance.value.footprint.visible ? '1' : '0',
  set: (val) => {
    settingStore.setAppearance({
      ...appearance.value,
      footprint: { ...appearance.value.footprint, visible: val === '1' }
    })
  }
})

const cameraFov = computed({
  get: () => camera.value.fov,
  set: (val) => {
    settingStore.setCamera({
      ...camera.value,
      fov: val
    })
  }
})

const heightClipping = computed({
  get: () => appearance.value.points.height,
  set: (val) => {
    settingStore.setAppearance({
      ...appearance.value,
      points: { ...appearance.value.points, height: val }
    })
  }
})

const reverseClipping = computed({
  get: () => appearance.value.points.reverse ? '1' : '0',
  set: (val) => {
    settingStore.setAppearance({
      ...appearance.value,
      points: { ...appearance.value.points, reverse: val === '1' }
    })
  }
})

const collectionMode = computed({
  get: () => appearance.value.collectionMode,
  set: (val) => {
    settingStore.setAppearance({
      ...appearance.value,
      collectionMode: val
    })
  }
})

function onClose() {
  isClosing.value = true
  setTimeout(() => {
    emit('close')
    isClosing.value = false
  }, 200)
}

function toggleFullscreen() {
  if (!document.fullscreenElement) {
    document.documentElement.requestFullscreen()
  } else {
    document.exitFullscreen()
  }
}

function handleExportConfig() {
  const state = {
    appearance: appearance.value,
    camera: camera.value,
    tools: settingStore.tools
  }
  const json = JSON.stringify(state, null, 2)
  const blob = new Blob([json], { type: 'application/json' })
  const href = URL.createObjectURL(blob)
  const link = document.createElement('a')
  link.href = href
  link.download = 'config.json'
  document.body.appendChild(link)
  link.click()
  document.body.removeChild(link)
  
  ElNotification({
    title: t('exportSuccess'),
    message: t('configExported'),
    type: 'success',
    duration: 3000
  })
}

function handleImportConfig() {
  fileInput.value.click()
}

function handleFileChange(event) {
  const file = event.target.files?.[0]
  if (file) {
    const reader = new FileReader()
    reader.onload = (e) => {
      try {
        const text = e.target?.result
        const state = JSON.parse(text)
        
        // 使用条件检查，只更新存在的key，缺少的key保持原值
        if (state.appearance) {
          settingStore.setAppearance(state.appearance)
        }
        if (state.camera) {
          settingStore.setCamera(state.camera)
        }
        if (state.tools) {
          settingStore.setTools(state.tools)
        }
        
        ElNotification({
          title: t('importSuccess'),
          message: t('configImported'),
          type: 'success',
          duration: 3000
        })
      } catch (error) {
        console.error('Failed to import config:', error)
        ElNotification({
          title: t('importFailed'),
          message: t('configImportFailed'),
          type: 'error',
          duration: 3000
        })
      }
    }
    reader.readAsText(file)
  }
  event.target.value = ''
}

function handleResetConfig() {
  if (settingStore.reset) {
    settingStore.reset()
    ElNotification({
      title: t('resetSuccess'),
      message: t('configReset'),
      type: 'success',
      duration: 3000
    })
  }
}
</script>

<style scoped>
.common-settings-sidebar {
  position: absolute;
  top: calc(var(--header-height, 40px) + 10px);
  bottom: calc(var(--header-height, 40px) + 10px);
  left: var(--base-spacing, 20px);
  width: var(--sidebar-width, 350px);
  z-index: 100;
  transition: transform 300ms ease, opacity 200ms ease;
  transform: translateX(calc(-1 * var(--sidebar-width, 350px) - var(--base-spacing, 20px)));
  opacity: 0;
  user-select: none;
  background-color: #141414;
  border-radius: var(--border-radius, 8px);
  box-shadow: 0 4px 20px rgba(0, 0, 0, 0.5);
  display: flex;
  flex-direction: column;
}

.common-settings-sidebar.opened {
  transform: translateX(0);
  opacity: 1;
}

.common-settings-sidebar.closing {
  opacity: 0;
  transform: translateX(-20px);
}

.sidebar-header {
  padding: 16px;
  display: flex;
  justify-content: space-between;
  align-items: flex-start;
}

.sidebar-title {
  display: flex;
  flex-direction: column;
  align-items: flex-end;
  gap: 0;
}

.title-main {
  font-size: var(--base-font-size, 14px);
  font-weight: bold;
  background: linear-gradient(90deg, #3b82f6, cyan);
  -webkit-background-clip: text;
  -webkit-text-fill-color: transparent;
  background-clip: text;
}

.title-sub {
  font-size: 12px;
  color: #6b7280;
  font-style: italic;
}

.header-actions {
  display: flex;
  justify-content: flex-end;
  gap: 4px;
}

.sidebar-content {
  flex: 1;
  overflow: hidden;
  display: flex;
  flex-direction: column;
}

.content-section {
  padding: 0 16px;
}

.section-title {
  font-size: var(--base-font-size, 14px);
  color: #ffffff;
}

.divider {
  width: 100%;
  height: 1px;
  background: #424242;
  margin: 6px 0;
}

.settings-scrollbar {
  flex: 1;
  padding: 0 16px;
  margin-top: 8px;
}

.popover-menu {
  display: flex;
  flex-direction: column;
  gap: 2px;
}

.popover-item {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 8px 12px;
  cursor: pointer;
  opacity: 0.8;
  transition: all 0.2s;
  font-size: 12px;
}

.popover-item:hover {
  opacity: 1;
  background-color: rgba(255, 255, 255, 0.1);
}

.settings-group {
  padding-top: 8px;
}

.setting-row {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-top: 26px;
}

.setting-row:first-child {
  margin-top: 2px;
}

.setting-label {
  font-size: var(--base-font-size, 14px);
  color: #ffffff;
  width: 35%;
  text-align: right;
  padding-right: 12px;
}

.setting-label-with-tooltip {
  font-size: var(--base-font-size, 14px);
  color: #ffffff;
  width: 35%;
  text-align: right;
  padding-right: 12px;
  display: flex;
  align-items: center;
  justify-content: flex-end;
  gap: 4px;
}

.tooltip-icon {
  cursor: pointer;
  color: var(--el-text-color-secondary);
}

.setting-control {
  width: 65%;
}

:deep(.el-collapse) {
  border: none;
}

:deep(.el-collapse-item__header) {
  height: 36px;
  font-size: var(--base-font-size, 14px);
  color: #ffffff;
  padding-left: 16px;
  padding-right: 16px;
  border: none;
  font-weight: 500;
}

:deep(.el-collapse-item__wrap) {
  border: none;
}

:deep(.el-collapse-item__content) {
  padding-bottom: 8px;
  padding-left: 10px;
  padding-right: 10px;
}

:deep(.el-collapse-item__arrow) {
  margin-left: 0;
  margin-right: 6px;
  order: -1;
}

:deep(.el-slider__runway) {
  margin-top: 4px;
  margin-bottom: 4px;
}

:deep(.el-segmented) {
  --el-segmented-item-selected-color: #ffffff;
  --el-segmented-item-selected-bg-color: var(--el-color-primary);
  --el-segmented-bg-color: var(--el-fill-color-light);
  --el-segmented-item-color: var(--el-text-color-regular);
  width: 100%;
  background-color: var(--el-fill-color-light);
  border-radius: 4px;
  padding: 2px;
}

:deep(.el-segmented__group) {
  gap: 2px;
}

:deep(.el-segmented__item) {
  flex: 1;
  color: var(--el-text-color-regular);
  border-radius: 3px;
  height: 26px;
  line-height: 26px;
  padding: 0 16px;
  font-size: 12px;
  transition: all 0.2s;
}

:deep(.el-segmented__item.is-selected) {
  color: #ffffff;
  background-color: var(--el-color-primary);
  border-radius: 3px;
}

:deep(.el-segmented__item:hover:not(.is-selected)) {
  color: var(--el-text-color-primary);
}

@media screen and (max-width: 768px) {
  .common-settings-sidebar {
    top: 10px;
    bottom: 10px;
    right: 10px;
    left: 10px;
    width: auto;
    transform: translateY(100vh);
  }

  .common-settings-sidebar.opened {
    transform: translateY(0);
  }

  .common-settings-sidebar.closing {
    transform: translateY(100vh);
  }
}
</style>
