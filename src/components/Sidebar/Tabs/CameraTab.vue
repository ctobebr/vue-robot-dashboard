<template>
  <div class="camera-tab">
    <el-scrollbar class="scroll-area">
      <el-collapse v-model="activeNames">
        <el-collapse-item name="follow">
          <template #title>
            {{ t('follow') }}
          </template>
          <div class="settings-stack">
            <div class="grid-row">
              <div class="grid-col-4">
                <div class="label-with-tooltip">
                  <el-tooltip :content="t('followModeTooltip')" placement="top">
                    <PhInfo size="14" class="tooltip-icon" />
                  </el-tooltip>
                  <span class="setting-label">{{ t('followMode') }}</span>
                </div>
              </div>
              <div class="grid-col-8">
                <el-segmented
                  v-model="followMode"
                  size="small"
                  :options="[{ label: t('pose'), value: 'pose' }, { label: t('position'), value: 'position' }]"
                />
              </div>
            </div>
          </div>
        </el-collapse-item>

        <el-collapse-item name="offset">
          <template #title>
            {{ t('change') }}
          </template>
          <div class="settings-stack">
            <div class="grid-row">
              <div class="grid-col-4">
                <span class="setting-label">{{ t('position') }} X</span>
              </div>
              <div class="grid-col-8">
                <NumberInput
                  v-model="offsetX"
                  :min="-10"
                  :max="10"
                  :step="0.1"
                  :precision="1"
                />
              </div>
            </div>
            <div class="grid-row">
              <div class="grid-col-4">
                <span class="setting-label">Y</span>
              </div>
              <div class="grid-col-8">
                <NumberInput
                  v-model="offsetY"
                  :min="-10"
                  :max="10"
                  :step="0.1"
                  :precision="1"
                />
              </div>
            </div>
            <div class="grid-row">
              <div class="grid-col-4">
                <span class="setting-label">Z</span>
              </div>
              <div class="grid-col-8">
                <NumberInput
                  v-model="offsetZ"
                  :min="-10"
                  :max="10"
                  :step="0.1"
                  :precision="1"
                />
              </div>
            </div>
          </div>
        </el-collapse-item>
      </el-collapse>
    </el-scrollbar>
  </div>
</template>

<script setup>
import { ref, computed } from 'vue'
import { useI18n } from 'vue-i18n'
import { useSettingStore } from '@/stores/setting'
import { PhInfo } from '@phosphor-icons/vue'
import NumberInput from '@/components/NumberInput/NumberInput.vue'

const { t } = useI18n()
const settingStore = useSettingStore()

const activeNames = ref(['follow', 'offset'])

const camera = computed(() => settingStore.camera)

const followMode = computed({
  get: () => camera.value.followMode,
  set: (val) => {
    settingStore.setCamera({
      ...camera.value,
      followMode: val
    })
  }
})

const offsetX = computed({
  get: () => camera.value.offset[0],
  set: (val) => {
    settingStore.setCamera({
      ...camera.value,
      offset: [val, camera.value.offset[1], camera.value.offset[2]]
    })
  }
})

const offsetY = computed({
  get: () => camera.value.offset[1],
  set: (val) => {
    settingStore.setCamera({
      ...camera.value,
      offset: [camera.value.offset[0], val, camera.value.offset[2]]
    })
  }
})

const offsetZ = computed({
  get: () => camera.value.offset[2],
  set: (val) => {
    settingStore.setCamera({
      ...camera.value,
      offset: [camera.value.offset[0], camera.value.offset[1], val]
    })
  }
})
</script>

<style scoped>
.camera-tab {
  margin: 6px 0;
  height: 75vh;
  overflow: hidden;
  flex-grow: 1;
}

.scroll-area {
  height: 100%;
  background-color: #141414;
}

.settings-stack {
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.grid-row {
  display: flex;
  align-items: center;
  width: 100%;
  min-height: 32px;
}

.grid-col-4 {
  width: 35%;
  display: flex;
  justify-content: flex-end;
  padding-right: 12px;
}

.grid-col-8 {
  width: 65%;
}

.label-with-tooltip {
  display: flex;
  align-items: center;
  justify-content: flex-end;
  gap: 4px;
}

.tooltip-icon {
  cursor: pointer;
  color: #888;
}

.setting-label {
  font-size: 14px;
  color: #ffffff;
  text-align: right;
}

:deep(.el-collapse) {
  border: none;
  background-color: #141414;
}

:deep(.el-collapse-item) {
  background-color: #141414;
}

:deep(.el-collapse-item__header) {
  height: 36px;
  font-size: 14px;
  padding-left: 16px;
  padding-right: 16px;
  border: none;
  font-weight: 500;
  background-color: #141414;
}

:deep(.el-collapse-item__wrap) {
  border: none;
  background-color: #141414;
}

:deep(.el-collapse-item__content) {
  padding-bottom: 16px;
  padding-left: 16px;
  padding-right: 16px;
  background-color: #141414;
}

:deep(.el-collapse-item__arrow) {
  margin-left: 0;
  margin-right: 6px;
  color: var(--el-text-color-secondary);
  order: -1;
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
</style>
