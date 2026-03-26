<template>
  <div ref="sidebarRef" class="sidebar" :class="{ 'sidebar-opened': opened, 'sidebar-closing': isClosing }">
    <div class="sidebar-header">
      <div class="sidebar-title">
        <span class="title-text">{{ t('moreSettings') }}</span>
      </div>
      <el-button
        link
        class="close-button"
        @click="onClose"
      >
        <PhX size="16" weight="bold" />
      </el-button>
    </div>
    <el-tabs v-model="activeTab" class="sidebar-tabs">
      <el-tab-pane :label="t('appearance')" name="appearance">
        <AppearanceTab />
      </el-tab-pane>
      <el-tab-pane :label="t('perspective')" name="perspective">
        <CameraTab />
      </el-tab-pane>
      <el-tab-pane :label="t('tools')" name="advanced">
        <ToolsTab />
      </el-tab-pane>
    </el-tabs>
  </div>
</template>

<script setup>
import { ref, computed } from 'vue'
import { useI18n } from 'vue-i18n'
import { useClickOutside } from '@/composables/useClickOutside'
import { PhX } from '@phosphor-icons/vue'
import AppearanceTab from './Tabs/AppearanceTab.vue'
import CameraTab from './Tabs/CameraTab.vue'
import ToolsTab from './Tabs/ToolsTab.vue'

const { t } = useI18n()

const sidebarRef = ref(null)
const isClosing = ref(false)

const props = defineProps({
  opened: Boolean
})
const emit = defineEmits(['close'])

const activeTab = ref('appearance')

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

function onClose() {
  isClosing.value = true
  setTimeout(() => {
    emit('close')
    isClosing.value = false
  }, 200)
}
</script>

<style scoped>
.sidebar {
  position: absolute;
  top: calc(var(--header-height, 40px) + 10px);
  bottom: calc(var(--header-height, 40px) + 10px);
  right: var(--base-spacing, 20px);
  width: var(--sidebar-width, 350px);
  z-index: 100;
  transition: transform 300ms ease, opacity 200ms ease;
  transform: translateX(calc(var(--sidebar-width, 350px) + var(--base-spacing, 20px)));
  opacity: 0;
  user-select: none;
  background-color: #141414;
  border-radius: var(--border-radius, 8px);
  box-shadow: 0 4px 20px rgba(0, 0, 0, 0.5);
  display: flex;
  flex-direction: column;
}

.sidebar-opened {
  transform: translateX(0);
  opacity: 1;
}

.sidebar-closing {
  opacity: 0;
  transform: translateX(20px);
}

.sidebar-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 16px;
}

.sidebar-title {
  font-size: var(--base-font-size, 14px);
  font-weight: 600;
  color: #ffffff;
}

.close-button {
  padding: 4px;
  color: #9ca3af;
}

.close-button:hover {
  color: #ffffff;
}

.sidebar-tabs {
  flex: 1;
  overflow: hidden;
  display: flex;
  flex-direction: column;
}

.sidebar-tabs :deep(.el-tabs__header) {
  margin: 0;
  padding: 0 16px;
  border-bottom: 1px solid #2a2a2a;
}

.sidebar-tabs :deep(.el-tabs__nav-wrap::after) {
  display: none;
}

.sidebar-tabs :deep(.el-tabs__item) {
  color: #9ca3af;
  font-weight: 500;
  font-size: var(--base-font-size, 14px);
}

.sidebar-tabs :deep(.el-tabs__item.is-active) {
  color: #3b82f6;
}

.sidebar-tabs :deep(.el-tabs__content) {
  flex: 1;
  overflow: hidden;
  padding: 16px;
}

.sidebar-tabs :deep(.el-tab-pane) {
  height: 100%;
  overflow-y: auto;
}

@media screen and (max-width: 768px) {
  .sidebar {
    top: 10px;
    bottom: 10px;
    right: 10px;
    left: 10px;
    width: auto;
    transform: translateY(100vh);
  }

  .sidebar-opened {
    transform: translateY(0);
  }

  .sidebar-closing {
    transform: translateY(100vh);
  }
}
</style>
