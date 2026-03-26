<template>
  <group :up="[0, 0, 1]">
    <template v-if="camera.isFirstPerson">
      <points
        v-for="(geometry, index) in firstPoints"
        :key="'first-' + index"
        :geometry="geometry"
        :material="pointCloudMaterial"
      />
    </template>
    <template v-else>
      <points
        v-for="(geometry, index) in thirdPoints"
        :key="'third-' + index"
        :geometry="geometry"
        :material="pointCloudMaterial"
      />
    </template>
  </group>
</template>

<script setup>
import { ref, watch, onMounted, onUnmounted } from 'vue'
import { load, registerLoaders, setLoaderOptions } from '@loaders.gl/core'
import { DracoLoader } from '@loaders.gl/draco'
import * as THREE from 'three'
import { useSettingStore } from '@/stores/setting'
import { useSocket } from '@/composables/useSocket'

registerLoaders([DracoLoader])

setLoaderOptions({
  modules: {
    'draco_wasm_wrapper.js': '/draco_wasm_wrapper.js',
    'draco_decoder.wasm': '/draco_decoder.wasm'
  }
})

const pointCloudMaterial = new THREE.ShaderMaterial({
  uniforms: {
    diffuse: {
      value: new THREE.Color('aqua')
    },
    size: {
      value: 0.1
    },
    scale: {
      value: 1
    },
    sizeAttenuation: {
      value: true
    },
    clipBoxPosition1: {
      value: new THREE.Vector3(0, 0, 0)
    },
    clipBoxRotation1: {
      value: new THREE.Vector3(0, 0, 0)
    },
    clipBoxScale1: {
      value: new THREE.Vector3(0, 0, 0)
    },
    clipBoxInside1: {
      value: false
    },
    clipBoxEnabled1: {
      value: true
    },
    clipBoxPosition2: {
      value: new THREE.Vector3(0, 0, 0)
    },
    clipBoxSize2: {
      value: new THREE.Vector3(1000, 1000, 1000)
    },
    clipBoxReverse2: {
      value: false
    },
    opacity: { value: 0.3 }
  },
  vertexShader: `
    uniform float size;
    uniform vec3 clipBoxPosition1;
    uniform vec3 clipBoxRotation1;
    uniform vec3 clipBoxScale1;
    uniform bool clipBoxInside1;
    uniform bool clipBoxEnabled1;
    uniform bool sizeAttenuation;
    varying vec3 vPosition;
    varying vec3 vColor;
    
    bool isInsideBox(vec3 point, vec3 boxPosition, vec3 boxRotation, vec3 boxScale) {
      mat4 rotationMatrix = mat4(
        cos(boxRotation.y) * cos(boxRotation.z), 
        cos(boxRotation.y) * sin(boxRotation.z), 
        -sin(boxRotation.y), 
        0.0,
        sin(boxRotation.x) * sin(boxRotation.y) * cos(boxRotation.z) - cos(boxRotation.x) * sin(boxRotation.z), 
        sin(boxRotation.x) * sin(boxRotation.y) * sin(boxRotation.z) + cos(boxRotation.x) * cos(boxRotation.z), 
        sin(boxRotation.x) * cos(boxRotation.y), 
        0.0,
        cos(boxRotation.x) * sin(boxRotation.y) * cos(boxRotation.z) + sin(boxRotation.x) * sin(boxRotation.z), 
        cos(boxRotation.x) * sin(boxRotation.y) * sin(boxRotation.z) - sin(boxRotation.x) * cos(boxRotation.z), 
        cos(boxRotation.x) * cos(boxRotation.y), 
        0.0,
        boxPosition.x, boxPosition.y, boxPosition.z, 1.0
      );
      vec3 localPos = vec3(inverse(rotationMatrix) * vec4(point, 1.0));
    
      if(localPos.x > -boxScale.x/2.0 && localPos.x < boxScale.x/2.0 &&
         localPos.y > -boxScale.y/2.0 && localPos.y < boxScale.y/2.0 &&
         localPos.z > -boxScale.z/2.0 && localPos.z < boxScale.z/2.0) {
           return true;
      }
      return false;
    }
    
    void main() {
      if(clipBoxEnabled1) {
        bool inside = isInsideBox(position, clipBoxPosition1, clipBoxRotation1, clipBoxScale1);
        if(clipBoxInside1 && !inside || !clipBoxInside1 && inside) {
          gl_Position = vec4(2.0, 2.0, 2.0, 1.0);
          return;
        }
      }
      vColor = color;
      vPosition = position;
      vec4 mvPosition = modelViewMatrix * vec4(position, 1.0);
      if (sizeAttenuation) {
          gl_PointSize = size * (30.0 / -mvPosition.z);
      } else {
            gl_PointSize = size * 10.0;
      }
      gl_Position = projectionMatrix * mvPosition;
    }
  `,
  fragmentShader: `
      uniform vec3 diffuse;
      uniform bool clipBoxReverse2;
      uniform vec3 clipBoxPosition2;
      uniform vec3 clipBoxSize2;
      uniform float opacity;
      
      varying vec3 vPosition;
      varying vec3 vColor;

      void main() {
        vec3 halfSize = clipBoxSize2 * 0.5;
        vec3 absLocalPosition = abs(clipBoxPosition2 - vPosition);
        if (clipBoxReverse2) {
          if (absLocalPosition.x > halfSize.x || absLocalPosition.y > halfSize.y || absLocalPosition.z < halfSize.z) {discard;}
        } else {
          if(absLocalPosition.x > halfSize.x || absLocalPosition.y > halfSize.y || absLocalPosition.z > halfSize.z) {discard;}
        }

        gl_FragColor = vec4( vColor, opacity );
      }
  `,
  vertexColors: true,
  transparent: true
})

const settingStore = useSettingStore()
const { socket } = useSocket()

const firstPoints = ref([])
const thirdPoints = ref([])

const { appearance, camera, tools } = settingStore

const totalVertexCount = ref(0)
const minVertex = ref(new THREE.Vector3(0, 0, 0))
const maxVertex = ref(new THREE.Vector3(0, 0, 0))
const maxLong = ref(0)
const maxWidth = ref(0)
const maxHeight = ref(0)

let minX = 0
let minY = 0
let minZ = 0
let maxX = 0
let maxY = 0
let maxZ = 0

let pointCloudListener = null

/**
 * 组件挂载时的初始化逻辑
 * 主要功能：
 * 1. 建立 Socket.io 点云数据监听器
 * 2. 处理接收到的点云数据
 * 3. 维护滑动窗口机制
 */
onMounted(() => {
  if (socket.value) {
    /**
     * 点云数据监听器
     * 处理从 Socket 接收到的点云数据
     * 
     * @param {ArrayBuffer} msg - 压缩的点云数据
     */
    pointCloudListener = (msg) => {
      /**
       * Draco 压缩数据解压逻辑
       * 使用 DracoLoader 解压点云数据
       * 
       * @param {ArrayBuffer} msg - 压缩的点云数据
       * @param {DracoLoader} DracoLoader - Draco 解压加载器
       * @param {Object} options - 解压选项
       * @returns {Promise} 解压后的数据
       */
      load(msg, DracoLoader, { worker: false }).then((data) => {
        const { POSITION, COLOR_0 } = data.attributes
        const { vertexCount, boundingBox } = data.header

        // 更新点云边界框
        if (minX > boundingBox[0][0]) minX = boundingBox[0][0]
        if (minY > boundingBox[0][1]) minY = boundingBox[0][1]
        if (minZ > boundingBox[0][2]) minZ = boundingBox[0][2]
        if (maxX < boundingBox[1][0]) maxX = boundingBox[1][0]
        if (maxY < boundingBox[1][1]) maxY = boundingBox[1][1]
        if (maxZ < boundingBox[1][2]) maxZ = boundingBox[1][2]

        // 更新顶点边界
        minVertex.value = new THREE.Vector3(minX, minY, minZ)
        maxVertex.value = new THREE.Vector3(maxX, maxY, maxZ)

        // 计算点云尺寸
        maxLong.value = Math.abs(maxX) + Math.abs(minX)
        maxWidth.value = Math.abs(maxY) + Math.abs(minY)
        maxHeight.value = Math.abs(maxZ) + Math.abs(minZ)

        /**
         * BufferGeometry 创建和属性设置
         * 为点云创建几何体并设置位置和颜色属性
         */
        const geometry = new THREE.BufferGeometry()
        // 设置颜色属性
        geometry.setAttribute('color', new THREE.BufferAttribute(COLOR_0.value, 3, true))
        // 设置位置属性
        geometry.setAttribute(
          'position',
          new THREE.Float32BufferAttribute(POSITION.value, POSITION.size)
        )

        /**
         * 滑动窗口机制
         * 管理点云数据的存储，保持固定数量的帧
         * 
         * firstPoints: 第一人称视角点云数据，最多保留 100 帧
         * thirdPoints: 第三人称视角点云数据，工作模式下最多保留 3000 帧
         */
        // 更新第一人称点云数据
        firstPoints.value = [...firstPoints.value, geometry]
        if (firstPoints.value.length >= 100) {
          firstPoints.value.shift()
        }

        // 更新第三人称点云数据
        if (appearance.collectionMode === 'work') {
          thirdPoints.value = [...thirdPoints.value, geometry]
          if (thirdPoints.value.length > 3000) {
            thirdPoints.value.shift()
          }
        } else {
          thirdPoints.value = [...thirdPoints.value, geometry]
        }
      })
    }

    // 注册 Socket 点云数据监听器
    socket.value.on('PointCloud', pointCloudListener)
  }
})

onUnmounted(() => {
  if (socket.value && pointCloudListener) {
    socket.value.off('PointCloud', pointCloudListener)
  }
})

watch(
  () => [appearance.points.size, appearance.points.alpha, appearance.points.sizeAttenuation],
  () => {
    pointCloudMaterial.uniforms.size.value = appearance.points.size
    pointCloudMaterial.uniforms.opacity.value = appearance.points.alpha
    pointCloudMaterial.uniforms.sizeAttenuation.value = appearance.points.sizeAttenuation
  },
  { deep: true }
)

watch(
  () => tools.clip,
  (clip) => {
    pointCloudMaterial.uniforms.clipBoxPosition1.value = new THREE.Vector3(
      clip.position[0],
      clip.position[1],
      clip.position[2]
    )
    pointCloudMaterial.uniforms.clipBoxRotation1.value = new THREE.Vector3(
      clip.rotation[0],
      clip.rotation[1],
      clip.rotation[2]
    )
    pointCloudMaterial.uniforms.clipBoxScale1.value = new THREE.Vector3(
      clip.scale[0],
      clip.scale[1],
      clip.scale[2]
    )
    pointCloudMaterial.uniforms.clipBoxInside1.value = clip.inside
    pointCloudMaterial.uniforms.clipBoxEnabled1.value = clip.enabled
  },
  { deep: true }
)

watch(
  () => [appearance.points.height, maxLong.value, maxWidth.value, maxHeight.value, minVertex.value, maxVertex.value, appearance.points.reverse],
  () => {
    pointCloudMaterial.uniforms.clipBoxPosition2.value = new THREE.Vector3(
      0,
      0,
      (maxVertex.value.z + minVertex.value.z) / 2 -
      (1.2 * maxHeight.value * (100 - appearance.points.height[1]) * 0.01) / 2 +
      (1.2 * maxHeight.value * appearance.points.height[0] * 0.01) / 2
    )

    pointCloudMaterial.uniforms.clipBoxSize2.value = new THREE.Vector3(
      1.5 * maxLong.value,
      1.5 * maxWidth.value,
      1.2 * maxHeight.value * (appearance.points.height[1] - appearance.points.height[0]) * 0.01
    )
    pointCloudMaterial.uniforms.clipBoxReverse2.value = appearance.points.reverse
  },
  { deep: true }
)

watch(
  () => appearance.collectionMode,
  (mode) => {
    if (mode === 'work') {
      if (thirdPoints.value.length > 3000) {
        thirdPoints.value = thirdPoints.value.slice(-3000)
      }
    }
  }
)
</script>
