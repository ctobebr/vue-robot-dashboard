import { defineStore } from 'pinia'
import { ref, computed } from 'vue'
import { getCaptcha, login, register } from '@/services/api/auth'

export const useAuthStore = defineStore('auth', () => {
  // State
  const token = ref(localStorage.getItem('token') || null)
  const userInfo = ref(() => {
    try {
      const stored = localStorage.getItem('userInfo')
      return stored ? JSON.parse(stored) : null
    } catch {
      return null
    }
  })
  const isLoggedIn = ref(!!token.value)
  const captchaKey = ref(null)
  const captchaImage = ref(null)
  const loginErrorCount = ref(0)

  // Getters
  const isAuthenticated = computed(() => isLoggedIn.value)

  // Actions
  async function fetchCaptcha() {
    try {
      const res = await getCaptcha()
      if (res.data.code === 200) {
        captchaKey.value = res.data.data.captchaKey
        captchaImage.value = res.data.data.captchaImage
        return true
      }
      return false
    } catch (error) {
      console.error('获取验证码失败:', error)
      return false
    }
  }

  async function userLogin(credentials) {
    try {
      const res = await login(credentials)
      // console.log('登录接口返回:', res.data)
      if (res.data.code === 200) {
        const { token: newToken, expiresIn, username } = res.data.data

        if (!newToken) {
          return { success: false, message: '登录响应缺少token' }
        }

        const userInfoData = { username }
        // console.log('保存用户信息:', userInfoData)

        token.value = newToken
        userInfo.value = userInfoData
        isLoggedIn.value = true
        loginErrorCount.value = 0

        localStorage.setItem('token', newToken)
        localStorage.setItem('userInfo', JSON.stringify(userInfoData))
        if (expiresIn) {
          const now = Date.now()
          const expiresInMs = expiresIn * 1000
          const tokenExpires = now + expiresInMs
          // console.log('设置过期时间:', {
          //   now: now,
          //   expiresIn: expiresIn,
          //   expiresInMs: expiresInMs,
          //   tokenExpires: tokenExpires,
          //   expiresDate: new Date(tokenExpires).toLocaleString()
          // })
          localStorage.setItem('tokenExpires', tokenExpires)
        }

        return { success: true, message: '登录成功' }
      } else {
        loginErrorCount.value++
        return { success: false, message: res.data.message || '登录失败' }
      }
    } catch (error) {
      loginErrorCount.value++
      console.error('登录失败:', error)
      return { success: false, message: error.response?.data?.message || '网络错误' }
    }
  }

  async function userRegister(data) {
    try {
      const res = await register(data)
      if (res.data.code === 200) {
        return { success: true, message: '注册成功' }
      } else {
        return { success: false, message: res.data.message || '注册失败' }
      }
    } catch (error) {
      console.error('注册失败:', error)
      return { success: false, message: error.response?.data?.message || '网络错误' }
    }
  }

  function logout() {
    token.value = null
    userInfo.value = null
    isLoggedIn.value = false
    captchaKey.value = null
    captchaImage.value = null
    loginErrorCount.value = 0

    localStorage.removeItem('token')
    localStorage.removeItem('userInfo')
    localStorage.removeItem('tokenExpires')
  }

  function loadTokenFromStorage() {
    const storedToken = localStorage.getItem('token')
    const storedUserInfo = localStorage.getItem('userInfo')
    const tokenExpires = localStorage.getItem('tokenExpires')

    if (storedToken && tokenExpires && Date.now() < parseInt(tokenExpires)) {
      token.value = storedToken
      try {
        userInfo.value = storedUserInfo ? JSON.parse(storedUserInfo) : null
      } catch {
        userInfo.value = null
      }
      isLoggedIn.value = true
      return true
    } else if (tokenExpires && Date.now() >= parseInt(tokenExpires)) {
      // Token已过期，清除
      logout()
      return false
    }
    return false
  }

  function shouldRefreshCaptcha() {
    return loginErrorCount.value >= 3
  }

  return {
    token,
    userInfo,
    isLoggedIn,
    captchaKey,
    captchaImage,
    loginErrorCount,
    isAuthenticated,
    fetchCaptcha,
    userLogin,
    userRegister,
    logout,
    loadTokenFromStorage,
    shouldRefreshCaptcha
  }
})
