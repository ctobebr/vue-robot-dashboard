import { ref, watch, computed } from 'vue'
import { useI18n } from 'vue-i18n'
import zhCn from 'element-plus/dist/locale/zh-cn.mjs'
import en from 'element-plus/dist/locale/en.mjs'

const elementLocales = {
  zh: zhCn,
  en: en
}

// 获取初始语言
function getInitialLocale() {
  if (typeof window !== 'undefined' && window.localStorage) {
    const savedLang = localStorage.getItem('lang') || 'zh'
    return elementLocales[savedLang] || zhCn
  }
  return zhCn
}

// 全局的 Element Plus locale 响应式引用
export const elementLocale = ref(getInitialLocale())

export function useElementLocale() {
  const { locale } = useI18n()

  // 监听语言变化，更新 Element Plus 的 locale
  watch(() => locale.value, (newLang) => {
    if (newLang && elementLocales[newLang]) {
      elementLocale.value = elementLocales[newLang]
    }
  }, { immediate: true })

  return {
    elementLocale: computed(() => elementLocale.value || zhCn)
  }
}
