<template>
  <div class="tools-tab">
    <el-scrollbar class="scroll-area">
      <el-collapse v-model="activeNames">
        <el-collapse-item name="clip">
          <template #title>
            <div class="title-with-icon">
              {{ t('clippingTool') }}
              <el-button
                link
                size="small"
                class="eye-button"
                @click.stop="toggleClipVisible"
              >
                <PhEye v-if="tools.clip.visible" size="14" />
                <PhEyeClosed v-else size="14" />
              </el-button>
            </div>
          </template>
          <div class="settings-stack">
            <div class="grid-row">
              <div class="grid-col-4">
                <span class="setting-label">{{ t('volumeClipping') }}</span>
              </div>
              <div class="grid-col-8">
                <el-segmented
                  v-model="clipEnabled"
                  size="small"
                  :options="[{ label: t('on'), value: 'on' }, { label: t('off'), value: 'off' }]"
                />
              </div>
            </div>
            <div class="grid-row">
              <div class="grid-col-4">
                <span class="setting-label">{{ t('clippingType') }}</span>
              </div>
              <div class="grid-col-8">
                <el-segmented
                  v-model="clipInside"
                  size="small"
                  :options="[{ label: t('inside'), value: 'inside' }, { label: t('outside'), value: 'outside' }]"
                />
              </div>
            </div>
          </div>
        </el-collapse-item>

        <el-collapse-item name="stats">
          <template #title>
            {{ t('performanceMonitoring') }}
          </template>
          <div class="settings-stack">
            <div class="grid-row">
              <div class="grid-col-4">
                <span class="setting-label">{{ t('display') }}</span>
              </div>
              <div class="grid-col-8">
                <el-segmented
                  v-model="statsEnabled"
                  size="small"
                  :options="[{ label: t('on'), value: 'on' }, { label: t('off'), value: 'off' }]"
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

const { t } = useI18n()
const settingStore = useSettingStore()

const activeNames = ref(['clip', 'stats'])

const tools = computed(() => settingStore.tools)

const clipEnabled = computed({
  get: () => tools.value.clip.enabled ? 'on' : 'off',
  set: (val) => {
    if (val === 'off') {
      settingStore.setTools({
        clip: {
          position: [0, 0, 0],
          rotation: [0, 0, 0],
          scale: [1, 1, 1],
          inside: false,
          enabled: false,
          visible: true
        }
      })
    } else {
      settingStore.setTools({
        clip: { enabled: true }
      })
    }
  }
})

const clipInside = computed({
  get: () => tools.value.clip.inside ? 'inside' : 'outside',
  set: (val) => {
    settingStore.setTools({
      clip: { inside: val === 'inside' }
    })
  }
})

const statsEnabled = computed({
  get: () => tools.value.stats.enabled ? 'on' : 'off',
  set: (val) => {
    settingStore.setTools({
      stats: { enabled: val === 'on' }
    })
  }
})

function toggleClipVisible() {
  settingStore.setTools({
    clip: { visible: !tools.value.clip.visible }
  })
}
</script>

<style scoped>
.tools-tab {
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
  color: #888;
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
  color: #888;
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
