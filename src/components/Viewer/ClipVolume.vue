<template>
  <div v-if="settingStore.tools.clip.enabled" @contextmenu.prevent="cycleMode">
    <!-- TransformControls 容器 -->
    <div ref="transformContainer" :style="{ visibility: settingStore.tools.clip.visible ? 'visible' : 'hidden' }"></div>
  </div>
</template>

<script setup>
import { ref, onMounted, onUnmounted, watch, nextTick } from 'vue'
import * as THREE from 'three'
import { TransformControls } from 'three/examples/jsm/controls/TransformControls.js'
import { useSettingStore } from '@/stores/setting'

const props = defineProps({
  camera: {
    type: Object,
    required: true
  },
  renderer: {
    type: Object,
    required: true
  },
  scene: {
    type: Object,
    required: true
  },
  controls: {
    type: Object,
    required: true
  }
})

const settingStore = useSettingStore()
const transformContainer = ref(null)

// 本地状态
const TRANSFORM_MODES = ['translate', 'scale', 'rotate']
let currentModeIndex = 0

// 引用
let clipBox = null
let edges = null
let transformControls = null

// 创建裁剪盒子
function createClipBox() {
  const { clip } = settingStore.tools
  
  // 创建盒子几何体
  const boxGeometry = new THREE.BoxGeometry(1, 1, 1)
  const boxMaterial = new THREE.MeshBasicMaterial({
    transparent: true,
    opacity: 0,
    depthWrite: false
  })
  clipBox = new THREE.Mesh(boxGeometry, boxMaterial)
  
  // 创建边框
  const edgesGeometry = new THREE.EdgesGeometry(boxGeometry)
  const edgesMaterial = new THREE.LineBasicMaterial({ 
    color: clip.visible ? 'hotpink' : 'black' 
  })
  edges = new THREE.LineSegments(edgesGeometry, edgesMaterial)
  clipBox.add(edges)
  
  // 设置位置和变换
  clipBox.position.set(...clip.position)
  clipBox.rotation.set(...clip.rotation)
  clipBox.scale.set(...clip.scale)
  
  // 添加到场景
  props.scene.add(clipBox)
  
  // 创建 TransformControls
  createTransformControls()
}

// 创建 TransformControls
function createTransformControls() {
  if (!clipBox || !props.camera || !props.renderer) return
  
  // 清理旧的 TransformControls
  if (transformControls) {
    transformControls.detach()
    transformControls.dispose()
    props.scene.remove(transformControls)
    transformControls = null
  }
  
  transformControls = new TransformControls(props.camera, props.renderer.domElement)
  transformControls.size = 0.5
  transformControls.mode = TRANSFORM_MODES[currentModeIndex]
  transformControls.attach(clipBox)
  
  // 监听变换事件
  transformControls.addEventListener('objectChange', onObjectChange)
  transformControls.addEventListener('dragging-changed', onDraggingChanged)
  
  props.scene.add(transformControls)
}

// 变换事件处理
function onObjectChange() {
  if (!clipBox) return
  
  const { position, rotation, scale } = clipBox
  settingStore.setTools({
    clip: {
      position: [position.x, position.y, position.z],
      rotation: [rotation.x, rotation.y, rotation.z],
      scale: [scale.x, scale.y, scale.z]
    }
  })
}

// 拖拽状态变化处理
function onDraggingChanged(event) {
  if (props.controls) {
    props.controls.enabled = !event.value
  }
}

// 切换模式
function cycleMode() {
  if (!transformControls) return
  
  currentModeIndex = (currentModeIndex + 1) % TRANSFORM_MODES.length
  transformControls.mode = TRANSFORM_MODES[currentModeIndex]
}

// 更新裁剪盒子
function updateClipBox() {
  if (!clipBox) return
  
  const { clip } = settingStore.tools
  clipBox.position.set(...clip.position)
  clipBox.rotation.set(...clip.rotation)
  clipBox.scale.set(...clip.scale)
  
  // 根据 visible 状态更新边框颜色和显示
  if (edges) {
    edges.material.color.set(clip.visible ? 'hotpink' : 'black')
  }
  
  // 控制 clipBox 的可见性（边框显示/隐藏）
  clipBox.visible = true // 始终显示，但边框颜色会变化
  
  // 控制 TransformControls 的可见性
  if (transformControls) {
    transformControls.visible = clip.visible
  }
}

// 清理资源
function cleanup() {
  if (transformControls) {
    transformControls.removeEventListener('objectChange', onObjectChange)
    transformControls.removeEventListener('dragging-changed', onDraggingChanged)
    transformControls.detach()
    transformControls.dispose()
    props.scene.remove(transformControls)
    transformControls = null
  }
  
  if (clipBox) {
    props.scene.remove(clipBox)
    clipBox.geometry.dispose()
    clipBox.material.dispose()
    if (edges) {
      edges.geometry.dispose()
      edges.material.dispose()
    }
    clipBox = null
    edges = null
  }
}

// 默认位置
const DEFAULT_POSITION = [0, 0, 0]
const DEFAULT_ROTATION = [0, 0, 0]
const DEFAULT_SCALE = [1, 1, 1]

// 生命周期
onMounted(() => {
  if (settingStore.tools.clip.enabled) {
    // 重置位置到默认值
    settingStore.setTools({
      clip: {
        position: [...DEFAULT_POSITION],
        rotation: [...DEFAULT_ROTATION],
        scale: [...DEFAULT_SCALE]
      }
    })
    createClipBox()
  }
})

onUnmounted(() => {
  cleanup()
})

// 监听 clip 变化
watch(() => settingStore.tools.clip, () => {
  const { clip } = settingStore.tools
  
  if (clip.enabled && !clipBox) {
    nextTick(() => createClipBox())
  } else if (!clip.enabled && clipBox) {
    cleanup()
  } else if (clip.enabled && clipBox) {
    updateClipBox()
  }
}, { deep: true })
</script>
