<template>
  <primitive :object="cameraInstance" />
</template>

<script setup>
import { ref, watch, onMounted, onUnmounted, onBeforeUnmount } from 'vue'
import * as THREE from 'three'
import { useSettingStore } from '@/stores/setting'
import { useSocket } from '@/composables/useSocket'

const settingStore = useSettingStore()
const { socket } = useSocket()
const { camera: cameraSettings } = settingStore

const cameraInstance = ref(null)
const hasSetCamera = ref(false)
const latestPosition = ref(null)
const latestOrientation = ref(null)
const cameraTarget = ref(new THREE.Vector3())

let animationFrameId = null
let baseStatusListener = null

/**
 * 相机动画循环函数
 * 处理相机的位置更新和目标点设置
 * 
 * @returns {void}
 */
function animate() {
  // 只有当最新位置和方向数据可用时才更新相机
  if (latestPosition.value && latestOrientation.value) {
    // 第一人称相机模式
    if (cameraSettings.isFirstPerson && cameraInstance.value) {
      // 设置目标点（相机前方 0.5 单位）
      const target = new THREE.Vector3(0.5, 0, 0)
      // 将四元数转换为欧拉角
      const euler = new THREE.Euler().setFromQuaternion(latestOrientation.value)

      // 根据跟随模式计算目标点
      if (cameraSettings.followMode === 'pose') {
        // 全姿态跟随：应用完整的欧拉角旋转
        target.applyEuler(euler).add(latestPosition.value)
      } else {
        // 仅方向跟随：只应用 Z 轴旋转
        target
          .applyEuler(new THREE.Euler().fromArray([0, 0, euler.z]))
          .add(latestPosition.value)
      }

      // 根据跟随设置更新相机位置和目标
      if (cameraSettings.follow) {
        // 平滑过渡到最新位置
        cameraInstance.value.position.lerp(latestPosition.value, 0.1)
        cameraTarget.value.lerp(target, 0.1)
        cameraInstance.value.lookAt(cameraTarget.value)
      } else if (!hasSetCamera.value) {
        // 首次设置相机位置
        cameraInstance.value.position.lerp(latestPosition.value, 0.1)
        cameraTarget.value.lerp(target, 0.1)
        cameraInstance.value.lookAt(cameraTarget.value)
        hasSetCamera.value = true
      }
    } 
    // 第三人称相机模式
    else if (cameraInstance.value) {
      if (cameraSettings.follow) {
        // 平滑过渡到固定位置 (10, 10, 10)
        cameraInstance.value.position.lerp(new THREE.Vector3(10, 10, 10), 0.1)
        cameraTarget.value.lerp(new THREE.Vector3(0, 0, 0), 0.1)
        cameraInstance.value.lookAt(cameraTarget.value)
      } else if (!hasSetCamera.value) {
        // 首次设置相机位置
        cameraInstance.value.position.lerp(new THREE.Vector3(10, 10, 10), 0.1)
        cameraTarget.value.lerp(new THREE.Vector3(0, 0, 0), 0.1)
        cameraInstance.value.lookAt(cameraTarget.value)
        hasSetCamera.value = true
      }
    }
  }
  
  // 请求下一帧动画
  animationFrameId = requestAnimationFrame(animate)
}

onMounted(() => {
  cameraInstance.value = new THREE.PerspectiveCamera(
    cameraSettings.fov,
    window.innerWidth / window.innerHeight,
    0.1,
    1000
  )
  cameraInstance.value.position.set(10, 10, 10)
  cameraInstance.value.up.set(0, 0, 1)

  if (socket.value) {
    /**
     * Socket BaseStatus 消息监听器
     * 处理从 Socket 接收到的基础状态数据
     * 
     * @param {Object} msg - 基础状态消息
     * @param {Object} msg.currentPose - 当前姿态信息
     * @param {Object} msg.currentPose.position - 位置信息
     * @param {Object} msg.currentPose.orientation - 方向信息（四元数）
     */
    baseStatusListener = (msg) => {
      const { currentPose } = msg
      const { position, orientation } = currentPose
      const { x, y, z } = position
      const { x: qx, y: qy, z: qz, w: qw } = orientation
      
      // 更新相机方向（四元数）
      latestOrientation.value = new THREE.Quaternion(qx, qy, qz, qw)
      
      // 应用相机偏移量并更新相机位置
      const cameraOffset = cameraSettings.offset
      latestPosition.value = new THREE.Vector3(x, y, z).add(
        new THREE.Vector3(cameraOffset[0], cameraOffset[1], cameraOffset[2])
      )
    }
    
    // 注册 Socket BaseStatus 消息监听器
    socket.value.on('BaseStatus', baseStatusListener)
  }

  animate()
})

onUnmounted(() => {
  if (animationFrameId) {
    cancelAnimationFrame(animationFrameId)
  }
})

onBeforeUnmount(() => {
  if (socket.value && baseStatusListener) {
    socket.value.off('BaseStatus', baseStatusListener)
  }
})

watch(
  () => cameraSettings.fov,
  (fov) => {
    if (cameraInstance.value) {
      cameraInstance.value.fov = fov
      cameraInstance.value.updateProjectionMatrix()
    }
  }
)

watch(
  () => cameraSettings.isFirstPerson,
  () => {
    hasSetCamera.value = false
  }
)
</script>
