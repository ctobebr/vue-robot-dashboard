<template>
  <div class="toolbar">
    <div class="toolbar-buttons">
      <el-button 
        :type="camera.follow ? 'primary' : 'info'"
        class="toolbar-btn"
        :title="t('viewFollow')"
        @click="toggleCameraFollow"
      >
        <PhNavigationArrow size="30" />
      </el-button>

      <el-popover placement="right" :width="200" trigger="click" :show-arrow="false">
        <template #reference>
          <span>
            <el-button
              type="info"
              class="toolbar-btn"
              :title="t('switchView')"
            >
              <PhPerspective size="30" />
            </el-button>
          </span>
        </template>
        <div class="popover-menu">
          <div 
            class="menu-item" 
            :class="{ active: camera.isFirstPerson }"
            @click="setFirstPerson"
          >
            <PhUserFocus size="20" />
            <span>{{ t('firstPerson') }}</span>
          </div>
          <div 
            class="menu-item" 
            :class="{ active: !camera.isFirstPerson }"
            @click="setThirdPerson"
          >
            <PhCube size="20" />
            <span>{{ t('thirdPerson') }}</span>
          </div>
        </div>
      </el-popover>

      <el-button 
        type="info"
        class="toolbar-btn"
        :title="t('commonSettings')"
        @click="handleOpenCommonSettings"
      >
        <PhGearFine size="30" />
      </el-button>

      <el-button 
        type="info"
        class="toolbar-btn"
        :title="t('dataList')"
        @click="handleOpenDataListModal"
      >
        <PhDatabase size="30" />
      </el-button>
    </div>
  </div>
</template>

<script setup>
import { computed } from 'vue'
import { useI18n } from 'vue-i18n'
import { useSettingStore } from '@/stores/setting'
import { PhNavigationArrow, PhPerspective, PhUserFocus, PhCube, PhGearFine, PhDatabase } from '@phosphor-icons/vue'

const { t } = useI18n()
const settingStore = useSettingStore()

const props = defineProps({
  openCommonSettings: Boolean,
  openDataListModal: Boolean
})
const emit = defineEmits(['update:openCommonSettings', 'update:openDataListModal'])

const camera = computed(() => settingStore.camera)
const appearance = computed(() => settingStore.appearance)

function handleOpenCommonSettings() {
  emit('update:openCommonSettings', !props.openCommonSettings)
}

function handleOpenDataListModal() {
  emit('update:openDataListModal', !props.openDataListModal)
}

function toggleCameraFollow() {
  settingStore.setCamera({
    ...camera.value,
    follow: !camera.value.follow
  })
}

function setFirstPerson() {
  settingStore.setCamera({
    ...camera.value,
    isFirstPerson: true
  })
  settingStore.setAppearance({
    ...appearance.value,
    footprint: {
      ...appearance.value.footprint,
      visible: false
    },
    location: {
      ...appearance.value.location,
      visible: false
    }
  })
}

function setThirdPerson() {
  settingStore.setCamera({
    ...camera.value,
    isFirstPerson: false
  })
}
</script>

<style scoped>
.toolbar {
  position: absolute;
  top: 50%;
  left: var(--base-spacing, 20px);
  transform: translateY(-50%);
  z-index: 100;
}

.toolbar-buttons {
  display: flex;
  flex-direction: column;
  gap: 8px;
  align-items: center;
}

.toolbar-btn {
  width: 60px;
  height: 60px;
  padding: 0;
  margin: 0;
  display: flex;
  align-items: center;
  justify-content: center;
  border-radius: var(--border-radius, 8px);
  border: none;
  flex-shrink: 0;
}

.toolbar-btn :deep(.el-button__content) {
  display: flex;
  align-items: center;
  justify-content: center;
}

.toolbar-btn :deep(.el-icon) {
  margin: 0;
  font-size: var(--icon-size-lg, 30px);
}

:deep(.el-popover) {
  padding: 0;
  border: none;
}

:deep(.el-popover .el-popover__content) {
  padding: 0;
}

.popover-menu {
  padding: 0;
  border-radius: 4px;
  border: none;
  overflow: hidden;
}

.menu-item {
  color: #ffffff;
  padding: 10px 12px;
  margin: 0;
  cursor: pointer;
  opacity: 0.6;
  display: flex;
  justify-content: flex-start;
  align-items: center;
  gap: 8px;
  font-size: var(--base-font-size, 14px);
  font-weight: 500;
  transition: all 0.2s;
  white-space: nowrap;
}

.menu-item:hover {
  opacity: 1;
  background-color: rgba(255, 255, 255, 0.1);
}

.menu-item.active {
  opacity: 1;
  background-color: rgba(255, 255, 255, 0.15);
}

/* Responsive adjustments for Toolbar */
@media screen and (max-width: 320px) {
  .toolbar {
    left: 8px;
  }

  .toolbar-btn {
    width: 48px;
    height: 48px;
  }

  .toolbar-buttons {
    gap: 6px;
  }
}

@media screen and (min-width: 321px) and (max-width: 768px) {
  .toolbar {
    left: 12px;
  }

  .toolbar-btn {
    width: 52px;
    height: 52px;
  }

  .toolbar-buttons {
    gap: 8px;
  }
}

@media screen and (min-width: 1441px) {
  .toolbar {
    left: 24px;
  }

  .toolbar-btn {
    width: 72px;
    height: 72px;
  }
}
</style>
