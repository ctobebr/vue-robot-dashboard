<template>
  <primitive :object="axesHelper" />
</template>

<script setup>
import { ref, watch, onMounted } from 'vue'
import * as THREE from 'three'
import { useSettingStore } from '@/stores/setting'

const settingStore = useSettingStore()

const axesHelper = ref(null)

onMounted(() => {
  axesHelper.value = new THREE.AxesHelper(settingStore.appearance.axes.size)
  axesHelper.value.visible = settingStore.appearance.axes.visible
})

watch(
  () => [settingStore.appearance.axes.size, settingStore.appearance.axes.visible],
  ([size, visible]) => {
    if (axesHelper.value) {
      axesHelper.value.dispose()
      axesHelper.value = new THREE.AxesHelper(size)
      axesHelper.value.visible = visible
    }
  },
  { deep: true }
)
</script>
