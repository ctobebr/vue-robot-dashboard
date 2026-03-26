<template>
  <primitive v-if="gridHelper" :object="gridHelper" />
</template>

<script setup>
import { ref, watch, onMounted } from 'vue'
import * as THREE from 'three'
import { useSettingStore } from '@/stores/setting'

const settingStore = useSettingStore()

const gridHelper = ref(null)

function createGrid() {
  const scaleplate = settingStore.appearance.scaleplate
  if (scaleplate.shape === 'grid') {
    gridHelper.value = new THREE.GridHelper(scaleplate.size, scaleplate.division)
    gridHelper.value.rotation.x = Math.PI / 2
  } else {
    gridHelper.value = new THREE.PolarGridHelper(scaleplate.size, scaleplate.division)
    gridHelper.value.rotation.x = Math.PI / 2
  }
  
  if (gridHelper.value) {
    const material = gridHelper.value.material
    const lineMaterial = material
    if ('transparent' in lineMaterial) {
      lineMaterial.transparent = true
      lineMaterial.opacity = scaleplate.alpha
      lineMaterial.color.set(scaleplate.color)
    }
    gridHelper.value.visible = scaleplate.visible
  }
}

onMounted(() => {
  createGrid()
})

watch(
  () => settingStore.appearance.scaleplate,
  () => {
    if (gridHelper.value) {
      gridHelper.value.dispose()
    }
    createGrid()
  },
  { deep: true }
)
</script>
