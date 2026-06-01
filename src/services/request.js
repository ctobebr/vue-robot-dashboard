import axios from 'axios'

// 获取环境变量
const isDev = import.meta.env.DEV
const apiBaseUrl = import.meta.env.VITE_API_BASE_URL || '/api'

// 创建axios实例
const request = axios.create({
  baseURL: apiBaseUrl,
  timeout: 10000,
  headers: {
    'Content-Type': 'application/json',
  },
})

// 请求拦截器 - 自动添加 Token
request.interceptors.request.use(
  (config) => {
    // 从 localStorage 获取 token
    const token = localStorage.getItem('token')
    if (token) {
      config.headers.Authorization = `Bearer ${token}`
    }
    
    // 开发环境打印请求信息
    if (isDev) {
      console.log(`[API Request] ${config.method?.toUpperCase()} ${config.url}`, config.data || '')
    }
    
    return config
  },
  (error) => {
    return Promise.reject(error)
  }
)

// 响应拦截器
request.interceptors.response.use(
  (response) => {
    // 开发环境打印响应信息
    if (isDev) {
      console.log(`[API Response] ${response.config.url}`, response.data)
    }
    return response
  },
  (error) => {
    // 处理 401 未授权错误
    if (error.response?.status === 401) {
      console.error('Token 已过期或无效，请重新登录')
      // 可以在这里触发登出逻辑
      // import('@/stores/auth').then(({ useAuthStore }) => {
      //   const authStore = useAuthStore()
      //   authStore.logout()
      // })
    }
    
    // 开发环境打印错误信息
    if (isDev) {
      console.error(`[API Error] ${error.config?.url}`, error.response?.status, error.response?.data)
    }
    
    return Promise.reject(error)
  }
)

export default request
