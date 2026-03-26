import { createI18n } from 'vue-i18n'

import en from './locales/en/translation.json'
import zh from './locales/zh/translation.json'

const savedLang = localStorage.getItem('lang') || 'zh'

const i18n = createI18n({
  legacy: false,
  locale: savedLang,
  fallbackLocale: 'en',
  messages: {
    en,
    zh
  }
})

export { i18n }
