<template>
  <div class="appearance-tab">
    <el-scrollbar class="scroll-area">
      <el-collapse v-model="activeNames">
        <el-collapse-item name="pointcloud">
          <template #title>
            {{ t('pointCloud') }}
          </template>
          <div class="settings-stack">
            <div class="grid-row">
              <div class="grid-col-4">
                <span class="setting-label">{{ t('sizeAttenuation') }}</span>
              </div>
              <div class="grid-col-8">
                <el-segmented
                  v-model="sizeAttenuation"
                  size="small"
                  :options="[{ label: t('open'), value: true }, { label: t('close'), value: false }]"
                />
              </div>
            </div>
            <div class="grid-row">
              <div class="grid-col-4">
                <span class="setting-label">{{ t('shape') }}</span>
              </div>
              <div class="grid-col-8">
                <el-select 
                  v-model="pointShape" 
                  size="small" 
                  style="width: 100%;"
                >
                  <el-option :label="t('circle')" value="circle" />
                  <el-option :label="t('square')" value="square" />
                </el-select>
              </div>
            </div>
          </div>
        </el-collapse-item>

        <el-collapse-item name="scaleplate">
          <template #title>
            <div class="title-with-icon">
              {{ t('coordinateRuler') }}
              <el-button
                link
                size="small"
                class="eye-button"
                @click.stop="toggleScaleplateVisible"
              >
                <PhEye v-if="appearance.scaleplate.visible" size="14" />
                <PhEyeClosed v-else size="14" />
              </el-button>
            </div>
          </template>
          <div class="settings-stack">
            <div class="grid-row">
              <div class="grid-col-4">
                <span class="setting-label">{{ t('shape') }}</span>
              </div>
              <div class="grid-col-8">
                <el-select 
                  v-model="scaleplateShape" 
                  size="small" 
                  style="width: 100%;"
                >
                  <el-option :label="t('grid')" value="grid" />
                  <el-option :label="t('polar')" value="polar" />
                </el-select>
              </div>
            </div>
            <div class="grid-row">
              <div class="grid-col-4">
                <span class="setting-label">{{ t('size') }}</span>
              </div>
              <div class="grid-col-8">
                <NumberInput
                  v-model="scaleplateSize"
                  :max="50"
                  :min="1"
                  :precision="0"
                />
              </div>
            </div>
            <div class="grid-row">
              <div class="grid-col-4">
                <span class="setting-label">{{ t('reticle') }}</span>
              </div>
              <div class="grid-col-8">
                <NumberInput
                  v-model="scaleplateDivision"
                  :max="50"
                  :min="1"
                  :precision="0"
                />
              </div>
            </div>
            <div class="grid-row">
              <div class="grid-col-4">
                <span class="setting-label">{{ t('opacity') }}</span>
              </div>
              <div class="grid-col-8">
                <NumberInput
                  v-model="scaleplateAlpha"
                  :max="1"
                  :min="0.1"
                  :precision="1"
                  :step="0.1"
                />
              </div>
            </div>
            <div class="grid-row">
              <div class="grid-col-4">
                <span class="setting-label">{{ t('color') }}</span>
              </div>
              <div class="grid-col-8">
                <el-color-picker 
                  v-model="scaleplateColor" 
                  size="small"
                  show-alpha
                  style="width: 100%;"
                />
              </div>
            </div>
          </div>
        </el-collapse-item>

        <el-collapse-item name="axes">
          <template #title>
            {{ t('axes') }}
          </template>
          <div class="settings-stack">
            <div class="grid-row">
              <div class="grid-col-4">
                <span class="setting-label">{{ t('size') }}</span>
              </div>
              <div class="grid-col-8">
                <NumberInput
                  v-model="axesSize"
                  :max="10"
                  :min="1"
                  :precision="0"
                />
              </div>
            </div>
          </div>
        </el-collapse-item>

        <el-collapse-item name="footprint">
          <template #title>
            {{ t('footprint') }}
          </template>
          <div class="settings-stack">
            <div class="grid-row">
              <div class="grid-col-4">
                <span class="setting-label">{{ t('size') }}</span>
              </div>
              <div class="grid-col-8">
                <NumberInput
                  v-model="footprintSize"
                  :max="5"
                  :min="1"
                  :precision="0"
                />
              </div>
            </div>
            <div class="grid-row">
              <div class="grid-col-4">
                <span class="setting-label">{{ t('color') }}</span>
              </div>
              <div class="grid-col-8">
                <el-color-picker 
                  v-model="footprintColor" 
                  size="small"
                  show-alpha
                  style="width: 100%;"
                />
              </div>
            </div>
          </div>
        </el-collapse-item>

        <el-collapse-item name="location">
          <template #title>
            <div class="title-with-icon">
              {{ t('positioning') }}
              <el-button
                link
                size="small"
                class="eye-button"
                @click.stop="toggleLocationVisible"
              >
                <PhEye v-if="appearance.location.visible" size="14" />
                <PhEyeClosed v-else size="14" />
              </el-button>
            </div>
          </template>
          <div class="settings-stack">
            <div class="grid-row">
              <div class="grid-col-4">
                <span class="setting-label">{{ t('size') }}</span>
              </div>
              <div class="grid-col-8">
                <NumberInput
                  v-model="locationSize"
                  :max="10"
                  :min="1"
                  :step="1"
                  :precision="0"
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
import { PhEye, PhEyeClosed } from '@phosphor-icons/vue'
import NumberInput from '@/components/NumberInput/NumberInput.vue'

const { t } = useI18n()
const settingStore = useSettingStore()

const activeNames = ref(['pointcloud', 'scaleplate', 'axes', 'footprint', 'location'])

const appearance = computed(() => settingStore.appearance)

const sizeAttenuation = computed({
  get: () => appearance.value.points.sizeAttenuation,
  set: (val) => {
    settingStore.setAppearance({
      ...appearance.value,
      points: { ...appearance.value.points, sizeAttenuation: val }
    })
  }
})

const pointShape = computed({
  get: () => appearance.value.points.shape,
  set: (val) => {
    settingStore.setAppearance({
      ...appearance.value,
      points: { ...appearance.value.points, shape: val }
    })
  }
})

const scaleplateShape = computed({
  get: () => appearance.value.scaleplate.shape,
  set: (val) => {
    settingStore.setAppearance({
      ...appearance.value,
      scaleplate: { ...appearance.value.scaleplate, shape: val }
    })
  }
})

const scaleplateSize = computed({
  get: () => appearance.value.scaleplate.size,
  set: (val) => {
    settingStore.setAppearance({
      ...appearance.value,
      scaleplate: { ...appearance.value.scaleplate, size: val }
    })
  }
})

const scaleplateDivision = computed({
  get: () => appearance.value.scaleplate.division,
  set: (val) => {
    settingStore.setAppearance({
      ...appearance.value,
      scaleplate: { ...appearance.value.scaleplate, division: val }
    })
  }
})

const scaleplateAlpha = computed({
  get: () => appearance.value.scaleplate.alpha,
  set: (val) => {
    settingStore.setAppearance({
      ...appearance.value,
      scaleplate: { ...appearance.value.scaleplate, alpha: val }
    })
  }
})

const scaleplateColor = computed({
  get: () => appearance.value.scaleplate.color,
  set: (val) => {
    settingStore.setAppearance({
      ...appearance.value,
      scaleplate: { ...appearance.value.scaleplate, color: val }
    })
  }
})

const axesSize = computed({
  get: () => appearance.value.axes.size,
  set: (val) => {
    settingStore.setAppearance({
      ...appearance.value,
      axes: { ...appearance.value.axes, size: val }
    })
  }
})

const footprintSize = computed({
  get: () => appearance.value.footprint.size,
  set: (val) => {
    settingStore.setAppearance({
      ...appearance.value,
      footprint: { ...appearance.value.footprint, size: val }
    })
  }
})

const footprintColor = computed({
  get: () => appearance.value.footprint.color,
  set: (val) => {
    settingStore.setAppearance({
      ...appearance.value,
      footprint: { ...appearance.value.footprint, color: val }
    })
  }
})

const locationSize = computed({
  get: () => appearance.value.location.size,
  set: (val) => {
    settingStore.setAppearance({
      ...appearance.value,
      location: { ...appearance.value.location, size: val }
    })
  }
})

function toggleScaleplateVisible() {
  settingStore.setAppearance({
    ...appearance.value,
    scaleplate: { ...appearance.value.scaleplate, visible: !appearance.value.scaleplate.visible }
  })
}

function toggleLocationVisible() {
  settingStore.setAppearance({
    ...appearance.value,
    location: { ...appearance.value.location, visible: !appearance.value.location.visible }
  })
}
</script>

<style scoped>
.appearance-tab {
  margin: 6px 0;
  height: 75vh;
  overflow: hidden;
  flex-grow: 1;
}

.scroll-area {
  height: 100%;
  background-color: #141414;
}

.title-with-icon {
  display: flex;
  align-items: center;
  justify-content: space-between;
  width: 100%;
  padding-right: 16px;
}

.eye-button {
  margin-left: auto;
  padding: 0;
  color: var(--el-text-color-secondary);
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

:deep(.el-select) {
  width: 100%;
}

:deep(.el-select .el-select__wrapper) {
  background-color: #2a2a2a;
  box-shadow: none;
  min-height: 30px;
  height: 30px;
}

:deep(.el-select .el-select__selection) {
  color: #ffffff;
  font-size: 14px;
}

:deep(.el-select .el-select__placeholder) {
  color: #888;
}

:deep(.el-color-picker) {
  width: 100%;
  height: 30px;
}

:deep(.el-color-picker .el-color-picker__trigger) {
  width: 100%;
  height: 30px;
  background-color: #2a2a2a;
  border-color: #3a3a3a;
}
</style>
