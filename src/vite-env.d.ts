/// <reference types="vite/client" />
// 保留ts入口，不影响业务可删除
declare module '*.vue' {
  import type { DefineComponent } from 'vue'
  const component: DefineComponent<{}, {}, any>
  export default component
}

interface ImportMetaEnv {
  readonly VITE_DEVICE_SN: string
}

interface ImportMeta {
  readonly env: ImportMetaEnv
}
