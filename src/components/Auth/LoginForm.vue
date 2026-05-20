<template>
  <div class="login-form">
    <!-- 用户名/手机号 -->
    <div class="form-item">
      <label class="form-label">用户名/手机号</label>
      <div class="input-wrapper">
        <el-icon class="input-icon"><User /></el-icon>
        <el-input
          v-model="form.username"
          placeholder="请输入用户名或手机号"
          class="auth-input"
          @keyup.enter="handleLogin"
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
          placeholder="请输入密码"
          class="auth-input"
          @keyup.enter="handleLogin"
        />
        <el-icon class="eye-icon" @click="showPassword = !showPassword">
          <View v-if="showPassword" />
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

    <!-- 登录按钮 -->
    <el-button
      type="primary"
      class="submit-btn"
      :loading="loading"
      @click="handleLogin"
    >
      登录
    </el-button>

    <!-- 切换注册 -->
    <div class="switch-mode">
      <span>还没有账号？</span>
      <a @click="$emit('switch-mode')">立即注册</a>
    </div>
  </div>
</template>

<script setup>
import { ref, reactive, onMounted, nextTick } from 'vue'
import { ElMessage } from 'element-plus'
import { User, Lock, View, Hide, Refresh } from '@element-plus/icons-vue'
import { useAuthStore } from '@/stores/auth'

const emit = defineEmits(['login-success', 'switch-mode'])

const authStore = useAuthStore()
const loading = ref(false)
const showPassword = ref(false)
const errorMessage = ref('')

const form = reactive({
  username: '',
  password: ''
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
  // 只保留数字
  const digit = value.replace(/[^0-9]/g, '').slice(0, 1)
  captchaDigits.value[index] = digit

  // 自动跳到下一个
  if (digit && index < 3) {
    nextTick(() => {
      captchaRefs.value[index + 1]?.focus()
    })
  }
}

// 验证码键盘处理
function handleCaptchaKeydown(index, event) {
  // 退格键删除并回到上一个
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
  
  // 聚焦到最后一个输入的框或下一个空框
  const focusIndex = Math.min(pasteData.length, 3)
  nextTick(() => {
    captchaRefs.value[focusIndex]?.focus()
  })
}

// 刷新验证码
async function refreshCaptcha() {
  await authStore.fetchCaptcha()
  // 清空验证码输入
  captchaDigits.value = ['', '', '', '']
  errorMessage.value = ''
}

// 登录处理
async function handleLogin() {
  // 表单验证
  if (!form.username.trim()) {
    errorMessage.value = '请输入用户名或手机号'
    return
  }
  if (!form.password) {
    errorMessage.value = '请输入密码'
    return
  }
  
  const captchaCode = captchaDigits.value.join('')
  if (captchaCode.length !== 4) {
    errorMessage.value = '请输入完整的验证码'
    return
  }

  loading.value = true
  errorMessage.value = ''

  try {
    const result = await authStore.userLogin({
      username: form.username.trim(),
      password: form.password,
      captchaKey: authStore.captchaKey,
      captchaCode: captchaCode
    })

    if (result.success) {
      ElMessage.success(result.message)
      emit('login-success')
    } else {
      errorMessage.value = result.message
      // 如果验证码错误，刷新验证码
      if (result.message.includes('验证码')) {
        refreshCaptcha()
      }
    }
  } catch (error) {
    errorMessage.value = '登录失败，请稍后重试'
    console.error('登录错误:', error)
  } finally {
    loading.value = false
  }
}

onMounted(() => {
  refreshCaptcha()
})
</script>

<style scoped>
.login-form {
  display: flex;
  flex-direction: column;
  gap: 16px;
}

.form-item {
  display: flex;
  flex-direction: column;
  gap: 8px;
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
  height: 40px;
}

:deep(.auth-input .el-input__inner::placeholder) {
  color: rgba(255, 255, 255, 0.4);
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
  height: 44px;
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
  height: 44px;
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
  height: 44px;
  font-size: 16px;
  font-weight: 600;
  border: none;
  margin-top: 8px;
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
  margin-top: 8px;
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
