<template>
  <line v-if="lineGeometry" :geometry="lineGeometry" :material="lineMaterial" :visible="settingStore.appearance.footprint.visible" />
</template>

<script setup>
import { ref, onMounted, onUnmounted, watch } from 'vue'
import * as THREE from 'three'
import { useSettingStore } from '@/stores/setting'
import { useSocket } from '@/composables/useSocket'

const settingStore = useSettingStore()
const { socket } = useSocket()

const points = ref([new THREE.Vector3(0, 0, 0)])
const lineGeometry = ref(null)
const lineMaterial = ref(null)

let baseStatusListener = null

function updateLine() {
  if (points.value.length > 1) {
    const positions = new Float32Array(points.value.length * 3)
    points.value.forEach((p, i) => {
      positions[i * 3] = p.x
      positions[i * 3 + 1] = p.y
      positions[i * 3 + 2] = p.z
    })
    
    if (lineGeometry.value) {
      lineGeometry.value.dispose()
    }
    
    lineGeometry.value = new THREE.BufferGeometry()
    lineGeometry.value.setAttribute('position', new THREE.BufferAttribute(positions, 3))
  }
}

onMounted(() => {
  lineMaterial.value = new THREE.LineBasicMaterial({
    color: settingStore.appearance.footprint.color,
    linewidth: settingStore.appearance.footprint.size
  })

  if (socket.value) {
    baseStatusListener = (msg) => {
      const { position: pos } = msg.currentPose
      const newPoint = new THREE.Vector3(pos.x, pos.y, pos.z)
      
      const lastPoint = points.value[points.value.length - 1]
      const distance = newPoint.distanceTo(lastPoint)
      
      if (distance >= 0.1) {
        points.value = [...points.value, newPoint]
        updateLine()
      }
    }
    
    socket.value.on('BaseStatus', baseStatusListener)
  }
})

onUnmounted(() => {
  if (socket.value && baseStatusListener) {
    socket.value.off('BaseStatus', baseStatusListener)
  }
  if (lineGeometry.value) lineGeometry.value.dispose()
  if (lineMaterial.value) lineMaterial.value.dispose()
})

watch(
  () => [settingStore.appearance.footprint.color, settingStore.appearance.footprint.size],
  ([color]) => {
    if (lineMaterial.value) {
      lineMaterial.value.color.set(color)
    }
  },
  { deep: true }
)
</script>
