<template>
  <el-config-provider :locale="elementLocale">
    <div id="app">
      <RouterView />
    </div>
  </el-config-provider>
</template>

<script setup>
import { RouterView } from 'vue-router'
import { provideSocket } from './composables/useSocket'
import { useElementLocale } from './composables/useElementLocale'
import { ElConfigProvider } from 'element-plus'

provideSocket()

// 使用 Element Plus 语言切换
const { elementLocale } = useElementLocale()
</script>

<style>
* {
  margin: 0;
  padding: 0;
  box-sizing: border-box;
}

html, body, #app {
  width: 100%;
  height: 100%;
  overflow: hidden;
}
</style>
