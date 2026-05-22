import { createApp } from 'vue'
import { createPinia } from 'pinia'
import ElementPlus from 'element-plus'
import 'element-plus/dist/index.css'
import 'element-plus/theme-chalk/dark/css-vars.css'
import App from './App.vue'
import router from './router'
import { i18n } from './i18n'
import { useAuthStore } from './stores/auth'
import './style.css'
import './styles/responsive.css'

const app = createApp(App)
const pinia = createPinia()

app.use(pinia)

// 初始化认证状态（检查token是否过期）
const authStore = useAuthStore()
authStore.loadTokenFromStorage()

app.use(router)
app.use(ElementPlus)
app.use(i18n)

app.mount('#app')
