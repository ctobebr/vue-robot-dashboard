<template>
  <div 
    ref="modalRef" 
    class="auth-modal" 
    :class="{ 'opened': opened, 'closing': isClosing }"
  >
    <div class="auth-header">
      <div class="auth-title">{{ authStore.isLoggedIn ? t('deviceChoice') : (isLoginMode ? t('userLogin') : t('userRegister')) }}</div>
      <div class="header-actions">
        <div class="icon-button" @click="toggleFullscreen" :title="t('fullscreen')">
          <PhCornersOut color="#ffffff" size="16" />
        </div>
        <div class="icon-button" @click="onClose" :title="t('close')">
          <PhX color="#ffffff" size="16" />
        </div>
      </div>
    </div>

    <div class="auth-content">
      <DeviceChoice 
        v-if="authStore.isLoggedIn"
        @select="handleDeviceSelect"
        @logout="handleLogout"
      />
      <LoginForm 
        v-else-if="isLoginMode" 
        @login-success="handleLoginSuccess"
        @switch-mode="isLoginMode = false"
      />
      <RegisterForm 
        v-else 
        @register-success="handleRegisterSuccess"
        @switch-mode="isLoginMode = true"
      />
    </div>
  </div>
</template>

<script setup>
import { ref, watch, computed } from 'vue'
import { useI18n } from 'vue-i18n'
import { PhCornersOut, PhX } from '@phosphor-icons/vue'
import { useClickOutside } from '@/composables/useClickOutside'
import { useAuthStore } from '@/stores/auth'
import LoginForm from './LoginForm.vue'
import RegisterForm from './RegisterForm.vue'
import DeviceChoice from './DeviceChoice.vue'

const props = defineProps({
  opened: {
    type: Boolean,
    default: false
  }
})

const emit = defineEmits(['close', 'login-success', 'device-select'])

const { t } = useI18n()
const authStore = useAuthStore()
const modalRef = ref(null)
const isClosing = ref(false)
const isLoginMode = ref(true)

useClickOutside(modalRef, null, () => {
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

function toggleFullscreen() {
  if (!document.fullscreenElement) {
    document.documentElement.requestFullscreen()
  } else {
    document.exitFullscreen()
  }
}

function handleLoginSuccess() {
  emit('login-success')
  onClose()
}

function handleRegisterSuccess() {
  isLoginMode.value = true
}

function handleDeviceSelect(device) {
  emit('device-select', device)
  onClose()
}

function handleLogout() {
  authStore.logout()
  isLoginMode.value = true
}

watch(() => props.opened, (newVal) => {
  if (newVal) {
    isClosing.value = false
    if (!authStore.isLoggedIn) {
      isLoginMode.value = true
    }
  }
})
</script>

<style scoped>
.auth-modal {
  position: absolute;
  top: calc(var(--header-height, 40px) + 10px);
  bottom: calc(var(--header-height, 40px) + 10px);
  left: var(--base-spacing, 20px);
  width: var(--sidebar-width, 350px);
  z-index: 200;
  transition: transform 300ms ease, opacity 200ms ease;
  transform: translateX(calc(-1 * var(--sidebar-width, 350px) - var(--base-spacing, 20px)));
  opacity: 0;
  user-select: none;
  background-color: rgba(20, 20, 20, 0.95);
  border-radius: var(--border-radius, 8px);
  box-shadow: 0 4px 20px rgba(0, 0, 0, 0.5);
  display: flex;
  flex-direction: column;
}

.auth-modal.opened {
  transform: translateX(0);
  opacity: 1;
}

.auth-modal.closing {
  transform: translateX(calc(-1 * var(--sidebar-width, 350px) - var(--base-spacing, 20px)));
  opacity: 0;
}

.auth-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 16px 20px;
  border-bottom: 1px solid rgba(255, 255, 255, 0.1);
  flex-shrink: 0;
}

.auth-title {
  font-size: 16px;
  font-weight: 600;
  color: #409eff;
}

.header-actions {
  display: flex;
  gap: 8px;
}

.icon-button {
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

.icon-button:hover {
  opacity: 1;
  background-color: rgba(255, 255, 255, 0.1);
}

.auth-content {
  flex: 1;
  overflow-y: auto;
  padding: 0;
}

.auth-content::-webkit-scrollbar {
  width: 6px;
}

.auth-content::-webkit-scrollbar-track {
  background: transparent;
}

.auth-content::-webkit-scrollbar-thumb {
  background: rgba(255, 255, 255, 0.2);
  border-radius: 3px;
}

.auth-content::-webkit-scrollbar-thumb:hover {
  background: rgba(255, 255, 255, 0.3);
}

@media screen and (max-width: 768px) {
  .auth-modal {
    width: 300px;
  }
}

@media screen and (max-width: 480px) {
  .auth-modal {
    width: 280px;
    left: 10px;
  }
}
</style>
