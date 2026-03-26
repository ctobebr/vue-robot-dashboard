<template>
  <group
    :position="position"
    :rotation="rotation"
    :up="[0, 0, 1]"
    :visible="settingStore.appearance.location.visible"
    :scale="[settingStore.appearance.location.size, settingStore.appearance.location.size, settingStore.appearance.location.size]"
  >
    <mesh :position="[0.1, 0, 0]" :rotation="[Math.PI / 2, 0, -Math.PI / 2]">
      <coneGeometry :args="[0.05, 0.08, 64]" />
      <meshNormalMaterial />
    </mesh>
    <mesh :rotation="[Math.PI / 2, 0, -Math.PI / 2]">
      <cylinderGeometry :args="[0.02, 0.02, 0.15, 64]" />
      <meshNormalMaterial />
    </mesh>
  </group>
</template>

<script setup>
import { ref, onMounted, onUnmounted } from 'vue'
import * as THREE from 'three'
import { useSettingStore } from '@/stores/setting'
import { useSocket } from '@/composables/useSocket'

const settingStore = useSettingStore()
const { socket } = useSocket()

const position = ref([0, 0, 0])
const rotation = ref([0, 0, 0])

let baseStatusListener = null

onMounted(() => {
  if (socket.value) {
    baseStatusListener = (msg) => {
      const { position: pos, orientation } = msg.currentPose
      position.value = [pos.x, pos.y, pos.z]
      
      const euler = new THREE.Euler().setFromQuaternion(
        new THREE.Quaternion(orientation.x, orientation.y, orientation.z, orientation.w)
      )
      rotation.value = [euler.x, euler.y, euler.z]
    }
    
    socket.value.on('BaseStatus', baseStatusListener)
  }
})

onUnmounted(() => {
  if (socket.value && baseStatusListener) {
    socket.value.off('BaseStatus', baseStatusListener)
  }
})
</script>
