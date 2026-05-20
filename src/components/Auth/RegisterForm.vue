<template>
  <div class="register-form">
    <!-- 用户名 -->
    <div class="form-item">
      <label class="form-label">用户名</label>
      <div class="input-wrapper">
        <el-icon class="input-icon"><User /></el-icon>
        <el-input
          v-model="form.username"
          placeholder="请输入用户名（2-20个字符）"
          class="auth-input"
          maxlength="20"
          @keyup.enter="handleRegister"
        />
      </div>
    </div>

    <!-- 手机号 -->
    <div class="form-item">
      <label class="form-label">手机号</label>
      <div class="input-wrapper">
        <el-icon class="input-icon"><Phone /></el-icon>
        <el-input
          v-model="form.phone"
          placeholder="请输入11位手机号"
          class="auth-input"
          maxlength="11"
          @keyup.enter="handleRegister"
        />
      </div>
    </div>

    <!-- 密码 -->
    <div class="form-item">
      <label class="form-label">密码</label>
      <div class="input-wrapper">
        <el-icon class="input-icon"><Lock /></el-icon>
        <el-input
          v-model="form.password"
          :type="showPassword ? 'text' : 'password'"
          placeholder="请输入密码（6-20位）"
          class="auth-input"
          maxlength="20"
          @keyup.enter="handleRegister"
        />
        <el-icon class="eye-icon" @click="showPassword = !showPassword">
          <View v-if="showPassword" />
          <Hide v-else />
        </el-icon>
      </div>
    </div>

    <!-- 确认密码 -->
    <div class="form-item">
      <label class="form-label">确认密码</label>
      <div class="input-wrapper">
        <el-icon class="input-icon"><Lock /></el-icon>
        <el-input
          v-model="form.confirmPassword"
          :type="showConfirmPassword ? 'text' : 'password'"
          placeholder="请再次输入密码"
          class="auth-input"
          maxlength="20"
          @keyup.enter="handleRegister"
        />
        <el-icon class="eye-icon" @click="showConfirmPassword = !showConfirmPassword">
          <View v-if="showConfirmPassword" />
          <Hide v-else />
        </el-icon>
      </div>
    </div>

    <!-- 验证码 -->
    <div class="form-item">
      <label class="form-label">验证码</label>
      <div class="captcha-wrapper">
        <div class="captcha-inputs">
          <el-input
            v-for="(digit, index) in captchaDigits"
            :key="index"
            v-model="captchaDigits[index]"
            class="captcha-input"
            maxlength="1"
            @input="handleCaptchaInput(index, $event)"
            @keydown="handleCaptchaKeydown(index, $event)"
            @paste="handleCaptchaPaste"
            :ref="el => setCaptchaRef(el, index)"
          />
        </div>
        <div class="captcha-image" @click="refreshCaptcha" :title="'点击刷新'">
          <img v-if="authStore.captchaImage" :src="authStore.captchaImage" alt="验证码" />
          <div v-else class="captcha-placeholder">
            <el-icon><Refresh /></el-icon>
          </div>
        </div>
      </div>
    </div>

    <!-- 错误提示 -->
    <div v-if="errorMessage" class="error-message">
      {{ errorMessage }}
    </div>

    <!-- 注册按钮 -->
    <el-button
      type="primary"
      class="submit-btn"
      :loading="loading"
      @click="handleRegister"
    >
      注册
    </el-button>

    <!-- 切换登录 -->
    <div class="switch-mode">
      <span>已有账号？</span>
      <a @click="$emit('switch-mode')">立即登录</a>
    </div>
  </div>
</template>

<script setup>
import { ref, reactive, onMounted, nextTick } from 'vue'
import { ElMessage } from 'element-plus'
import { User, Phone, Lock, View, Hide, Refresh } from '@element-plus/icons-vue'
import { useAuthStore } from '@/stores/auth'

const emit = defineEmits(['register-success', 'switch-mode'])

const authStore = useAuthStore()
const loading = ref(false)
const showPassword = ref(false)
const showConfirmPassword = ref(false)
const errorMessage = ref('')

const form = reactive({
  username: '',
  phone: '',
  password: '',
  confirmPassword: ''
})

const captchaDigits = ref(['', '', '', ''])
const captchaRefs = ref([])

function setCaptchaRef(el, index) {
  if (el) {
    captchaRefs.value[index] = el
  }
}

// 验证码输入处理
function handleCaptchaInput(index, value) {
  const digit = value.replace(/[^0-9]/g, '').slice(0, 1)
  captchaDigits.value[index] = digit

  if (digit && index < 3) {
    nextTick(() => {
      captchaRefs.value[index + 1]?.focus()
    })
  }
}

// 验证码键盘处理
function handleCaptchaKeydown(index, event) {
  if (event.key === 'Backspace' && !captchaDigits.value[index] && index > 0) {
    event.preventDefault()
    captchaDigits.value[index - 1] = ''
    nextTick(() => {
      captchaRefs.value[index - 1]?.focus()
    })
  }
}

// 验证码粘贴处理
function handleCaptchaPaste(event) {
  event.preventDefault()
  const pasteData = event.clipboardData.getData('text').replace(/[^0-9]/g, '').slice(0, 4)
  
  for (let i = 0; i < pasteData.length && i < 4; i++) {
    captchaDigits.value[i] = pasteData[i]
  }
  
  const focusIndex = Math.min(pasteData.length, 3)
  nextTick(() => {
    captchaRefs.value[focusIndex]?.focus()
  })
}

// 刷新验证码
async function refreshCaptcha() {
  await authStore.fetchCaptcha()
  captchaDigits.value = ['', '', '', '']
  errorMessage.value = ''
}

// 表单验证
function validateForm() {
  if (!form.username.trim()) {
    errorMessage.value = '请输入用户名'
    return false
  }
  if (form.username.trim().length < 2 || form.username.trim().length > 20) {
    errorMessage.value = '用户名长度应为2-20个字符'
    return false
  }
  if (!form.phone.trim()) {
    errorMessage.value = '请输入手机号'
    return false
  }
  if (!/^1[3-9]\d{9}$/.test(form.phone.trim())) {
    errorMessage.value = '请输入正确的11位手机号'
    return false
  }
  if (!form.password) {
    errorMessage.value = '请输入密码'
    return false
  }
  if (form.password.length < 6 || form.password.length > 20) {
    errorMessage.value = '密码长度应为6-20位'
    return false
  }
  if (form.password !== form.confirmPassword) {
    errorMessage.value = '两次输入的密码不一致'
    return false
  }
  
  const captchaCode = captchaDigits.value.join('')
  if (captchaCode.length !== 4) {
    errorMessage.value = '请输入完整的验证码'
    return false
  }
  
  return true
}

// 注册处理
async function handleRegister() {
  if (!validateForm()) return

  loading.value = true
  errorMessage.value = ''

  try {
    const result = await authStore.userRegister({
      username: form.username.trim(),
      phone: form.phone.trim(),
      password: form.password,
      captchaKey: authStore.captchaKey,
      captchaCode: captchaDigits.value.join('')
    })

    if (result.success) {
      ElMessage.success(result.message)
      emit('register-success')
    } else {
      errorMessage.value = result.message
      if (result.message.includes('验证码')) {
        refreshCaptcha()
      }
    }
  } catch (error) {
    errorMessage.value = '注册失败，请稍后重试'
    console.error('注册错误:', error)
  } finally {
    loading.value = false
  }
}

onMounted(() => {
  refreshCaptcha()
})
</script>

<style scoped>
.register-form {
  display: flex;
  flex-direction: column;
  gap: 12px;
}

.form-item {
  display: flex;
  flex-direction: column;
  gap: 6px;
}

.form-label {
  font-size: 14px;
  color: #ffffff;
  font-weight: 500;
}

.input-wrapper {
  position: relative;
  display: flex;
  align-items: center;
}

.input-icon {
  position: absolute;
  left: 12px;
  color: rgba(255, 255, 255, 0.5);
  font-size: 16px;
  z-index: 1;
}

.eye-icon {
  position: absolute;
  right: 12px;
  color: rgba(255, 255, 255, 0.5);
  font-size: 16px;
  cursor: pointer;
  z-index: 1;
  transition: color 0.2s;
}

.eye-icon:hover {
  color: rgba(255, 255, 255, 0.8);
}

:deep(.auth-input .el-input__wrapper) {
  background-color: rgba(255, 255, 255, 0.1);
  border: 1px solid rgba(255, 255, 255, 0.2);
  border-radius: 4px;
  padding-left: 40px;
  padding-right: 40px;
  box-shadow: none;
}

:deep(.auth-input .el-input__inner) {
  color: #ffffff;
  height: 38px;
}

:deep(.auth-input .el-input__inner::placeholder) {
  color: rgba(255, 255, 255, 0.4);
  font-size: 13px;
}

:deep(.auth-input .el-input__wrapper:hover) {
  border-color: rgba(255, 255, 255, 0.3);
}

:deep(.auth-input .el-input__wrapper.is-focus) {
  border-color: #409eff;
}

/* 验证码区域 */
.captcha-wrapper {
  display: flex;
  gap: 12px;
  align-items: center;
}

.captcha-inputs {
  display: flex;
  gap: 8px;
  flex: 1;
}

.captcha-input {
  width: 50px;
}

:deep(.captcha-input .el-input__wrapper) {
  background-color: rgba(255, 255, 255, 0.1);
  border: 1px solid rgba(255, 255, 255, 0.2);
  border-radius: 4px;
  padding: 0;
  box-shadow: none;
}

:deep(.captcha-input .el-input__inner) {
  color: #ffffff;
  height: 40px;
  text-align: center;
  font-size: 18px;
  font-weight: 600;
  padding: 0;
}

:deep(.captcha-input .el-input__wrapper:hover) {
  border-color: rgba(255, 255, 255, 0.3);
}

:deep(.captcha-input .el-input__wrapper.is-focus) {
  border-color: #409eff;
}

.captcha-image {
  width: 100px;
  height: 40px;
  border-radius: 4px;
  overflow: hidden;
  cursor: pointer;
  background-color: rgba(255, 255, 255, 0.1);
  display: flex;
  align-items: center;
  justify-content: center;
  border: 1px solid rgba(255, 255, 255, 0.2);
}

.captcha-image img {
  width: 100%;
  height: 100%;
  object-fit: cover;
}

.captcha-placeholder {
  color: rgba(255, 255, 255, 0.5);
  font-size: 20px;
}

/* 错误提示 */
.error-message {
  color: #f56c6c;
  font-size: 13px;
  text-align: center;
  padding: 4px 0;
}

/* 提交按钮 */
.submit-btn {
  width: 100%;
  height: 42px;
  font-size: 16px;
  font-weight: 600;
  border: none;
  margin-top: 4px;
  background: linear-gradient(90deg, #409eff, #00bcd4);
}

.submit-btn:hover {
  background: linear-gradient(90deg, #66b1ff, #33c9dc);
}

/* 切换模式 */
.switch-mode {
  text-align: center;
  font-size: 14px;
  color: rgba(255, 255, 255, 0.6);
  margin-top: 4px;
}

.switch-mode a {
  color: #409eff;
  cursor: pointer;
  margin-left: 4px;
}

.switch-mode a:hover {
  color: #66b1ff;
}
</style>
