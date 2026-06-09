<template>
  <div ref="containerRef" class="viewer-container">
    <StatsGl :enabled="settingStore.tools.stats.enabled" :renderer="rendererRef" />
    <ClipVolume 
      v-if="settingStore.tools.clip.enabled && scene && camera && renderer && controls"
      :camera="camera"
      :renderer="renderer"
      :scene="scene"
      :controls="controls"
    />
  </div>
</template>

<script setup>
import { ref, shallowRef, onMounted, onUnmounted, watch, nextTick } from 'vue'
import * as THREE from 'three'
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js'
import { Line2 } from 'three/examples/jsm/lines/Line2.js'
import { LineMaterial } from 'three/examples/jsm/lines/LineMaterial.js'
import { LineGeometry } from 'three/examples/jsm/lines/LineGeometry.js'
import { load, registerLoaders, setLoaderOptions } from '@loaders.gl/core'
import { DracoLoader } from '@loaders.gl/draco'
import { useSettingStore } from '@/stores/setting'
import { useDeviceStore } from '@/stores/device'
import { useSocket } from '@/composables/useSocket'
import { deviceAPI } from '@/services/api'
import StatsGl from './StatsGl.vue'
import ClipVolume from './ClipVolume.vue'

registerLoaders([DracoLoader])
setLoaderOptions({
  modules: {
    'draco_wasm_wrapper.js': '/draco_wasm_wrapper.js',
    'draco_decoder.wasm': '/draco_decoder.wasm',
  },
})

const settingStore = useSettingStore()
const deviceStore = useDeviceStore()
const { client, connected, subscribe, unsubscribe } = useSocket()

const containerRef = ref(null)
const rendererRef = shallowRef(null)
let scene
let camera
let renderer
let controls
let animationId

let axesHelper = null
let scaleplateHelper = null
let footprintLine = null
let footprintPoints = [new THREE.Vector3(0, 0, 0)]
let locationGroup = null

// 点云渲染：双数组分离模式（与 3d-viewer/PointCloud.tsx 一致）
// 第一视角和第三视角分别存储不同的帧数据，切换时显示不同历史范围
// 第一视角保留100帧（约20秒），第三视角保留3000帧（约10分钟）
// ⚠️ 所有 Three.js 对象使用普通变量存储，严禁放入 Vue 响应式系统
let pointCloudMaterial = null
let pointCloudGroup = null         // 单一 Group，当前视角的点云都在此 Group 中
let firstPersonFrames = []         // 第一视角帧数组，最大100帧
let thirdPersonFrames = []         // 第三视角帧数组，最大3000帧
const MAX_FIRST_PERSON_FRAMES = 100    // 第一视角最大帧数
const MAX_THIRD_PERSON_FRAMES = 3000   // 第三视角最大帧数

let latestPosition = null
let latestOrientation = null
let cameraTarget = new THREE.Vector3()
let hasSetCamera = false
let minVertex = new THREE.Vector3(0, 0, 0)
let maxVertex = new THREE.Vector3(0, 0, 0)
let maxLong = 0
let maxWidth = 0
let maxHeight = 0

// 帧序号，用于防止 Draco 异步解码乱序
let frameSeq = 0
// 调试统计
let debugStats = {
  totalFrames: 0,
  skippedFrames: 0,
  totalPoints: 0,
  lastLogTime: 0
}

function createPointCloudMaterial() {
  pointCloudMaterial = new THREE.ShaderMaterial({
    uniforms: {
      diffuse: {
        value: new THREE.Color('aqua'),
      },
      size: {
        value: settingStore.appearance.points.size,
      },
      scale: {
        value: 1,
      },
      sizeAttenuation: {
        value: settingStore.appearance.points.sizeAttenuation,
      },
      clipBoxPosition1: {
        value: new THREE.Vector3(0, 0, 0),
      },
      clipBoxRotation1: {
        value: new THREE.Vector3(0, 0, 0),
      },
      clipBoxScale1: {
        value: new THREE.Vector3(0, 0, 0),
      },
      clipBoxInside1: {
        value: false,
      },
      clipBoxEnabled1: {
        value: true,
      },
      clipBoxPosition2: {
        value: new THREE.Vector3(0, 0, 0),
      },
      clipBoxSize2: {
        value: new THREE.Vector3(1000, 1000, 1000),
      },
      clipBoxReverse2: {
        value: false,
      },
      opacity: { value: settingStore.appearance.points.alpha },
      shape: { value: settingStore.appearance.points.shape === 'circle' ? 1.0 : 0.0 },
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
      uniform float shape;
      
      varying vec3 vPosition;
      varying vec3 vColor;

      void main() {
        // 点云形状控制：圆形或方形
        if (shape > 0.5) {
          // 圆形：使用gl_PointCoord计算到中心的距离
          vec2 coord = gl_PointCoord - vec2(0.5);
          if (length(coord) > 0.5) discard;
        }
        // 方形：使用默认的方形点，无需额外处理
        
        // 裁剪盒逻辑
        vec3 halfSize = clipBoxSize2 * 0.5;
        vec3 absLocalPosition = abs(clipBoxPosition2 - vPosition);
        if (clipBoxReverse2) {
          if (absLocalPosition.x > halfSize.x || absLocalPosition.y > halfSize.y || absLocalPosition.z < halfSize.z) {discard;}
        } else {
          if(absLocalPosition.x > halfSize.x || absLocalPosition.y > halfSize.y || absLocalPosition.z > halfSize.z) {discard;}
        }
        gl_FragColor = vec4(vColor, opacity);
      }
    `,
    vertexColors: true,
    transparent: true,
  })
}

function createAxes() {
  if (axesHelper) {
    scene.remove(axesHelper)
    axesHelper.dispose()
  }
  axesHelper = new THREE.AxesHelper(settingStore.appearance.axes.size)
  axesHelper.visible = settingStore.appearance.axes.visible
  // 将坐标轴稍微抬高，避免与标尺重合
  axesHelper.position.y = 0.01
  scene.add(axesHelper)
}

function createScaleplate() {
  if (scaleplateHelper) {
    scene.remove(scaleplateHelper)
    scaleplateHelper.dispose()
  }
  
  const { size, division, color, alpha, visible, shape } = settingStore.appearance.scaleplate
  
  if (shape === 'grid') {
    scaleplateHelper = new THREE.GridHelper(size, division)
  } else {
    scaleplateHelper = new THREE.PolarGridHelper(size, division)
  }
  
  scaleplateHelper.rotation.x = Math.PI / 2
  const material = scaleplateHelper.material
  material.transparent = true
  material.opacity = alpha
  material.color.set(color)
  scaleplateHelper.visible = visible
  
  scene.add(scaleplateHelper)
}

function createFootprint() {
  if (footprintLine) {
    scene.remove(footprintLine)
    footprintLine.geometry.dispose()
    footprintLine.material.dispose()
  }
  
  const { size, visible, color } = settingStore.appearance.footprint
  const geometry = new LineGeometry()
  if (footprintPoints.length > 0) {
    const positions = []
    footprintPoints.forEach(p => {
      positions.push(p.x, p.y, p.z)
    })
    geometry.setPositions(positions)
  }
  const material = new LineMaterial({ 
    color: new THREE.Color(color), 
    linewidth: size,
    worldUnits: false,
    dashed: false,
    resolution: new THREE.Vector2(window.innerWidth, window.innerHeight)
  })
  footprintLine = new Line2(geometry, material)
  footprintLine.computeLineDistances()
  footprintLine.visible = visible
  scene.add(footprintLine)
}

function updateFootprint(point) {
  const lastPoint = footprintPoints[footprintPoints.length - 1]
  const distance = point.distanceTo(lastPoint)
  
  if (distance >= 0.1) {
    footprintPoints.push(point)
    if (footprintLine) {
      const positions = []
      footprintPoints.forEach(p => {
        positions.push(p.x, p.y, p.z)
      })
      footprintLine.geometry.setPositions(positions)
      footprintLine.computeLineDistances()
    }
  }
}

function createLocation() {
  if (locationGroup) {
    scene.remove(locationGroup)
    locationGroup.traverse(child => {
      if (child.geometry) child.geometry.dispose()
      if (child.material) child.material.dispose()
    })
  }

  const { size, visible } = settingStore.appearance.location
  locationGroup = new THREE.Group()
  locationGroup.visible = visible
  locationGroup.scale.set(size, size, size)
  locationGroup.up.set(0, 0, 1)

  // 初始位置在原点
  locationGroup.position.set(0, 0, 0)
  locationGroup.rotation.set(0, 0, 0)

  const coneGeometry = new THREE.ConeGeometry(0.05, 0.08, 64)
  const coneMaterial = new THREE.MeshNormalMaterial()
  const cone = new THREE.Mesh(coneGeometry, coneMaterial)
  cone.position.set(0.1, 0, 0)
  cone.rotation.set(Math.PI / 2, 0, -Math.PI / 2)
  locationGroup.add(cone)

  const cylinderGeometry = new THREE.CylinderGeometry(0.02, 0.02, 0.15, 64)
  const cylinderMaterial = new THREE.MeshNormalMaterial()
  const cylinder = new THREE.Mesh(cylinderGeometry, cylinderMaterial)
  cylinder.rotation.set(Math.PI / 2, 0, -Math.PI / 2)
  locationGroup.add(cylinder)

  scene.add(locationGroup)
}

function updateLocation(position, rotation) {
  if (locationGroup) {
    locationGroup.position.set(position[0], position[1], position[2])
    locationGroup.rotation.set(rotation[0], rotation[1], rotation[2])
  }
}

/**
 * 创建点云渲染结构：单一 Group
 * 双数组分离模式 — 第一视角和第三视角分别存储不同的帧数据
 * 与 3d-viewer/PointCloud.tsx 一致
 */
function createPointCloud() {
  // 清理旧的 Group 和帧数据
  if (pointCloudGroup) {
    scene.remove(pointCloudGroup)
  }
  firstPersonFrames.forEach(frame => {
    if (frame.geometry) frame.geometry.dispose()
  })
  thirdPersonFrames.forEach(frame => {
    if (frame.geometry) frame.geometry.dispose()
  })
  firstPersonFrames = []
  thirdPersonFrames = []

  pointCloudGroup = new THREE.Group()
  pointCloudGroup.up.set(0, 0, 1)
  scene.add(pointCloudGroup)
}

/**
 * 根据当前视角切换 Group 中显示的点云
 * 第一视角显示 firstPersonFrames，第三视角显示 thirdPersonFrames
 */
function updatePointCloudVisibility() {
  if (!pointCloudGroup) return

  const isFirst = settingStore.camera.isFirstPerson

  // 清除 Group 中所有子对象
  while (pointCloudGroup.children.length > 0) {
    pointCloudGroup.remove(pointCloudGroup.children[0])
  }

  // 根据视角添加对应的帧
  const frames = isFirst ? firstPersonFrames : thirdPersonFrames
  frames.forEach(frame => {
    pointCloudGroup.add(frame.points)
  })
}

/**
 * 将新帧的点云数据添加到两个视角的数组中
 * 同一帧数据同时添加到 firstPersonFrames 和 thirdPersonFrames
 * 但两个数组有不同的上限（100 vs 3000）
 */
function addPointCloudFrame(positionArray, colorArray, vertexCount) {
  if (!pointCloudMaterial || !positionArray || vertexCount === 0) return

  debugStats.totalFrames++

  // 为本帧创建独立的 BufferGeometry
  const geometry = new THREE.BufferGeometry()
  geometry.setAttribute('position', new THREE.BufferAttribute(positionArray, 3))

  if (colorArray && colorArray.length > 0) {
    geometry.setAttribute('color', new THREE.BufferAttribute(colorArray, 3, true))
  } else {
    const colors = new Float32Array(vertexCount * 3)
    for (let i = 0; i < vertexCount * 3; i++) {
      colors[i] = 1.0
    }
    geometry.setAttribute('color', new THREE.BufferAttribute(colors, 3))
  }

  geometry.computeBoundingSphere()

  // 创建独立的 Points 对象
  const points = new THREE.Points(geometry, pointCloudMaterial)

  // 添加到第一视角数组（最大100帧）
  firstPersonFrames.push({ geometry, points })
  while (firstPersonFrames.length > MAX_FIRST_PERSON_FRAMES) {
    const oldest = firstPersonFrames.shift()
    oldest.geometry.dispose()
  }

  // 添加到第三视角数组（最大3000帧）
  // 注意：需要为第三视角创建独立的 geometry 和 points
  const geometry3 = geometry.clone()
  const points3 = new THREE.Points(geometry3, pointCloudMaterial)
  thirdPersonFrames.push({ geometry: geometry3, points: points3 })
  while (thirdPersonFrames.length > MAX_THIRD_PERSON_FRAMES) {
    const oldest = thirdPersonFrames.shift()
    oldest.geometry.dispose()
  }

  // 根据当前视角更新显示
  updatePointCloudVisibility()

  const currentFrames = settingStore.camera.isFirstPerson ? firstPersonFrames : thirdPersonFrames
  debugStats.totalPoints = currentFrames.reduce((sum, f) =>
    sum + (f.geometry.attributes.position?.count || 0), 0)
}

function updatePointCloudMaterial() {
  if (!pointCloudMaterial) return
  
  const { size, alpha, sizeAttenuation, height, reverse, shape } = settingStore.appearance.points
  const { clip } = settingStore.tools
  
  pointCloudMaterial.uniforms.size.value = size
  pointCloudMaterial.uniforms.opacity.value = alpha
  pointCloudMaterial.uniforms.sizeAttenuation.value = sizeAttenuation
  pointCloudMaterial.uniforms.shape.value = shape === 'circle' ? 1.0 : 0.0
  
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
  
  pointCloudMaterial.uniforms.clipBoxPosition2.value = new THREE.Vector3(
    0,
    0,
    (maxVertex.z + minVertex.z) / 2 -
    (1.2 * maxHeight * (100 - height[1]) * 0.01) / 2 +
    (1.2 * maxHeight * height[0] * 0.01) / 2
  )
  
  pointCloudMaterial.uniforms.clipBoxSize2.value = new THREE.Vector3(
    1.5 * maxLong,
    1.5 * maxWidth,
    1.2 * maxHeight * (height[1] - height[0]) * 0.01
  )
  pointCloudMaterial.uniforms.clipBoxReverse2.value = reverse
}

function animate() {
  animationId = requestAnimationFrame(animate)
  controls.update()
  
  if (latestPosition && latestOrientation) {
    const { isFirstPerson, follow, followMode, offset } = settingStore.camera
    
    if (isFirstPerson) {
      const target = new THREE.Vector3(0.5, 0, 0)
      const euler = new THREE.Euler().setFromQuaternion(latestOrientation)
      
      if (followMode === 'pose') {
        target.applyEuler(euler).add(latestPosition)
      } else {
        target.applyEuler(new THREE.Euler(0, 0, euler.z)).add(latestPosition)
      }
      
      if (follow) {
        camera.position.lerp(latestPosition, 0.1)
        cameraTarget.lerp(target, 0.1)
        camera.lookAt(cameraTarget)
      } else if (!hasSetCamera) {
        camera.position.lerp(latestPosition, 0.1)
        cameraTarget.lerp(target, 0.1)
        camera.lookAt(cameraTarget)
        hasSetCamera = true
      }
    } else {
      if (follow) {
        camera.position.lerp(new THREE.Vector3(10, 10, 10), 0.1)
        cameraTarget.lerp(new THREE.Vector3(0, 0, 0), 0.1)
        camera.lookAt(cameraTarget)
      } else if (!hasSetCamera) {
        camera.position.lerp(new THREE.Vector3(10, 10, 10), 0.1)
        cameraTarget.lerp(new THREE.Vector3(0, 0, 0), 0.1)
        camera.lookAt(cameraTarget)
        hasSetCamera = true
      }
    }
  }
  
  renderer.render(scene, camera)
}

function handleResize() {
  if (!containerRef.value) return
  camera.aspect = containerRef.value.clientWidth / containerRef.value.clientHeight
  camera.updateProjectionMatrix()
  renderer.setSize(containerRef.value.clientWidth, containerRef.value.clientHeight)
  if (footprintLine && footprintLine.material) {
    footprintLine.material.resolution.set(
      containerRef.value.clientWidth * Math.max(window.devicePixelRatio, 2),
      containerRef.value.clientHeight * Math.max(window.devicePixelRatio, 2)
    )
  }
}

// 订阅引用
let baseStatusSub = null

// 标记是否已经订阅，防止重复订阅
let hasSubscribed = false

// 点云数据轮询定时器
let frameDataTimer = null
const FRAME_DATA_INTERVAL = 200 // 200ms轮询一次点云数据（Draco解码需要时间）

// 日志频率控制
let lastLogTime = 0
const LOG_INTERVAL = 5000 // 5秒输出一次日志
function canLog() {
  const now = Date.now()
  if (now - lastLogTime >= LOG_INTERVAL) {
    lastLogTime = now
    return true
  }
  return false
}

// 获取点云数据
async function fetchFrameData() {
  // 注意：frameSeq 在确认数据有效后才递增，防止空数据导致的序号跳跃
  // 空数据返回时 frameSeq 不变，避免后续有效帧的 currentSeq 与 frameSeq 不匹配而被跳过

  if (canLog()) {
    console.log('[Viewer] fetchFrameData 被调用, timer:', frameDataTimer)
  }

  try {
    if (canLog()) {
      console.log('[Viewer] 准备调用 getFrameData，sensorName: Lidar')
    }

    const response = await deviceAPI.getFrameData('Lidar')
    if (canLog()) {
      console.log('[Viewer] getFrameData 响应类型:', typeof response.data)
      console.log('[Viewer] getFrameData 数据大小:', response.data?.byteLength || 'N/A', 'bytes')
    }

    // 检查响应数据：空数据时不递增 frameSeq，直接返回
    if (!response.data || response.data.byteLength === 0) {
      console.warn('[Viewer] getFrameData 返回空数据')
      return
    }

    // 确认有有效数据后才递增帧序号，防止空数据导致的竞态
    const currentSeq = ++frameSeq

    // 使用 DracoLoader 解码二进制数据
    const arrayBuffer = response.data
    if (canLog()) {
      console.log('[Viewer] 开始Draco解码, seq:', currentSeq)
    }

    // 创建 Blob 对象，因为 DracoLoader 需要 URL 或 Blob
    const blob = new Blob([arrayBuffer])
    const url = URL.createObjectURL(blob)

    // 使用 loaders.gl 解码 Draco 数据
    load(url, DracoLoader, { worker: false })
      .then((loadedData) => {
        // 检查是否已有更新的帧解码完成，防止乱序
        if (currentSeq !== frameSeq) {
          if (canLog()) {
            console.warn('[Viewer] 丢弃过期帧 seq:', currentSeq, '当前最新:', frameSeq)
          }
          debugStats.skippedFrames++
          URL.revokeObjectURL(url)
          return
        }

        debugStats.totalFrames++

        if (canLog()) {
          console.log('[Viewer] Draco解码成功 seq:', currentSeq, loadedData)
        }

        // 释放 URL 对象
        URL.revokeObjectURL(url)

        // 提取属性数据
        const { POSITION, COLOR_0 } = loadedData.attributes
        const { vertexCount, boundingBox } = loadedData.header

        if (canLog()) {
          console.log('[Viewer] 点云数据:', {
            seq: currentSeq,
            vertexCount,
            boundingBox,
            hasPosition: !!POSITION,
            hasColor: !!COLOR_0
          })
        }

        // 更新边界框 — 累积式，只扩大不缩小（与 React 项目 PointCloud.tsx 一致）
        // 关键修复：如果每帧替换边界框，当新帧的边界框小于历史累积范围时，
        // clipBox 会缩小，导致边缘点被 shader 的裁剪盒逻辑丢弃，产生闪烁
        if (boundingBox) {
          const bbMinX = boundingBox[0][0]
          const bbMinY = boundingBox[0][1]
          const bbMinZ = boundingBox[0][2]
          const bbMaxX = boundingBox[1][0]
          const bbMaxY = boundingBox[1][1]
          const bbMaxZ = boundingBox[1][2]

          if (bbMinX < minVertex.x) minVertex.x = bbMinX
          if (bbMinY < minVertex.y) minVertex.y = bbMinY
          if (bbMinZ < minVertex.z) minVertex.z = bbMinZ
          if (bbMaxX > maxVertex.x) maxVertex.x = bbMaxX
          if (bbMaxY > maxVertex.y) maxVertex.y = bbMaxY
          if (bbMaxZ > maxVertex.z) maxVertex.z = bbMaxZ

          maxLong = Math.abs(maxVertex.x) + Math.abs(minVertex.x)
          maxWidth = Math.abs(maxVertex.y) + Math.abs(minVertex.y)
          maxHeight = Math.abs(maxVertex.z) + Math.abs(minVertex.z)
        }

        // 提取 position 和 color 原始数组数据
        let positionArray = null
        let colorArray = null
        if (POSITION && POSITION.value) {
          positionArray = POSITION.value instanceof Float32Array
            ? POSITION.value
            : new Float32Array(POSITION.value)
        }
        if (COLOR_0 && COLOR_0.value) {
          colorArray = COLOR_0.value instanceof Uint8Array
            ? COLOR_0.value
            : new Uint8Array(COLOR_0.value)
        }

        // 单帧独立渲染：将新帧数据创建为独立的 THREE.Points
        // 每帧创建独立的 BufferGeometry，创建后永不修改（与 React 项目一致）
        addPointCloudFrame(positionArray, colorArray, vertexCount)
        updatePointCloudMaterial()

        // 定期输出调试统计
        if (canLog()) {
          console.log('[Viewer] 点云渲染完成, seq:', currentSeq, '调试统计:', {
            totalFrames: debugStats.totalFrames,
            skippedFrames: debugStats.skippedFrames,
            totalPoints: debugStats.totalPoints,
            currentView: settingStore.camera.isFirstPerson ? 'first' : 'third'
          })
        }
      })
      .catch((error) => {
        URL.revokeObjectURL(url)
        console.error('[Viewer] Draco解码失败 seq:', currentSeq, error)
      })

  } catch (error) {
    console.error('[Viewer] 获取点云数据失败:', error)
    console.error('[Viewer] 错误详情:', error.response?.data || error.message)
  }
  if (canLog()) {
    console.log('[Viewer] fetchFrameData 执行完成')
  }
}

// 开始轮询点云数据
function startFrameDataPolling() {
  if (canLog()) {
    console.log('[Viewer] 尝试开始轮询，当前timer:', frameDataTimer)
  }
  if (frameDataTimer) {
    if (canLog()) {
      console.log('[Viewer] 轮询已在运行中，跳过')
    }
    return
  }
  if (canLog()) {
    console.log('[Viewer] 开始轮询点云数据，间隔:', FRAME_DATA_INTERVAL, 'ms')
  }
  frameDataTimer = setInterval(fetchFrameData, FRAME_DATA_INTERVAL)
  if (canLog()) {
    console.log('[Viewer] 轮询已启动，timer:', frameDataTimer)
  }
}

// 停止轮询点云数据
function stopFrameDataPolling() {
  if (canLog()) {
    console.log('[Viewer] 尝试停止轮询，当前timer:', frameDataTimer)
  }
  if (frameDataTimer) {
    clearInterval(frameDataTimer)
    frameDataTimer = null
    if (canLog()) {
      console.log('[Viewer] 停止轮询点云数据')
    }
  } else {
    if (canLog()) {
      console.log('[Viewer] 没有运行的轮询需要停止')
    }
  }
}

function setupSocketListeners() {
  watch([connected, () => deviceStore.currentDevice], ([isConnected, deviceId]) => {
    if (isConnected && deviceId && !hasSubscribed) {
      hasSubscribed = true

      // 点云数据通过 HTTP 接口轮询获取（fetchFrameData），不再通过 WebSocket 接收
      // WebSocket 仅订阅设备状态（BaseStatus）用于相机跟随和轨迹更新
      baseStatusSub = subscribe(deviceId, 'status', (msg) => {
        if (msg.type === 'BaseStatus') {
          const data = msg.data || msg
          const { position, orientation } = data.currentPose || data
          const { x, y, z } = position
          const { x: qx, y: qy, z: qz, w: qw } = orientation

          const newPoint = new THREE.Vector3(x, y, z)
          updateFootprint(newPoint)

          latestOrientation = new THREE.Quaternion(qx, qy, qz, qw)
          latestPosition = new THREE.Vector3(x, y, z).add(
            new THREE.Vector3(
              settingStore.camera.offset[0],
              settingStore.camera.offset[1],
              settingStore.camera.offset[2]
            )
          )

          const euler = new THREE.Euler().setFromQuaternion(latestOrientation)
          updateLocation([x, y, z], [euler.x, euler.y, euler.z])
        }
      })
    }

    if (!isConnected || !deviceId) {
      hasSubscribed = false
    }
  })
}

onMounted(() => {
  if (!containerRef.value) return
  
  scene = new THREE.Scene()
  // 不设置scene.background，会使用默认背景色全黑
  // scene.background = new THREE.Color('#001122')
  
  camera = new THREE.PerspectiveCamera(
    settingStore.camera.fov,
    containerRef.value.clientWidth / containerRef.value.clientHeight,
    0.1,
    1000
  )
  camera.position.set(10, 10, 10)
  camera.up.set(0, 0, 1)
  
  // 清除全黑背景色，这里使用透明背景，让CSS的径向渐变背景显示出来
  renderer = new THREE.WebGLRenderer({ antialias: false, alpha: true })
  renderer.setClearColor(0x000000, 0) // 透明背景
  renderer.setPixelRatio(Math.max(window.devicePixelRatio, 2))
  renderer.setSize(containerRef.value.clientWidth, containerRef.value.clientHeight)
  containerRef.value.appendChild(renderer.domElement)
  
  // 更新响应式引用，触发 StatsGl 重新初始化
  rendererRef.value = renderer
  
  controls = new OrbitControls(camera, renderer.domElement)
  controls.enableDamping = true
  
  const ambientLight = new THREE.AmbientLight(0xffffff, 0.5)
  scene.add(ambientLight)
  
  createPointCloudMaterial()
  createAxes()
  createScaleplate()
  createFootprint()
  createLocation()
  createPointCloud()
  
  animate()
  setupSocketListeners()
  
  window.addEventListener('resize', handleResize)
})

watch(
  () => settingStore.appearance.axes,
  () => {
    createAxes()
  },
  { deep: true }
)

watch(
  () => settingStore.appearance.scaleplate,
  () => {
    createScaleplate()
  },
  { deep: true }
)

watch(
  () => settingStore.appearance.footprint,
  () => {
    createFootprint()
  },
  { deep: true }
)

watch(
  () => settingStore.appearance.location,
  () => {
    createLocation()
  },
  { deep: true }
)

watch(
  () => settingStore.tools.clip,
  () => {
    updatePointCloudMaterial()
  },
  { deep: true }
)

watch(
  () => settingStore.appearance.points,
  () => {
    updatePointCloudMaterial()
  },
  { deep: true }
)

watch(
  () => settingStore.camera.fov,
  (newFov) => {
    camera.fov = newFov
    camera.updateProjectionMatrix()
  }
)

watch(
  () => settingStore.camera.isFirstPerson,
  () => {
    hasSetCamera = false
    updatePointCloudVisibility()
  }
)



watch(
  () => settingStore.appearance.collectionMode,
  () => {
    // collectionMode 切换时无需特殊处理
    // 多帧累积模式下每帧独立，无需合并/拆分
  }
)

// 监听录制状态，控制点云数据轮询
watch(
  () => deviceStore.recording,
  (isRecording) => {
    if (isRecording) {
      startFrameDataPolling()
    } else {
      stopFrameDataPolling()
    }
  }
)

/**
 * 重置 Viewer 状态
 * 清空所有点云数据、足迹、位置等，模拟页面 reload 的效果
 * 但保持 WebSocket 连接和设备连接
 */
function resetViewer() {
  if (canLog()) {
    console.log('[Viewer] 开始重置...')
  }

  // 1. 清空点云数据（释放所有帧的 geometry）
  firstPersonFrames.forEach(frame => {
    if (frame.geometry) frame.geometry.dispose()
  })
  thirdPersonFrames.forEach(frame => {
    if (frame.geometry) frame.geometry.dispose()
  })
  firstPersonFrames = []
  thirdPersonFrames = []
  if (pointCloudGroup) {
    while (pointCloudGroup.children.length > 0) {
      pointCloudGroup.remove(pointCloudGroup.children[0])
    }
  }
  frameSeq = 0
  debugStats = {
    totalFrames: 0,
    skippedFrames: 0,
    totalPoints: 0,
    lastLogTime: 0
  }
  if (canLog()) {
    console.log('[Viewer] 点云数据已清空')
  }

  // 2. 清空足迹数据
  footprintPoints = [new THREE.Vector3(0, 0, 0)]
  if (footprintLine) {
    scene.remove(footprintLine)
    footprintLine.geometry.dispose()
    footprintLine.material.dispose()
    footprintLine = null
  }
  if (canLog()) {
    console.log('[Viewer] 足迹数据已清空')
  }

  // 3. 清空位置标记
  if (locationGroup) {
    scene.remove(locationGroup)
    locationGroup.traverse(child => {
      if (child.geometry) child.geometry.dispose()
      if (child.material) child.material.dispose()
    })
    locationGroup = null
  }
  if (canLog()) {
    console.log('[Viewer] 位置标记已清空')
  }

  // 4. 重置相机位置
  camera.position.set(10, 10, 10)
  camera.up.set(0, 0, 1)
  controls.target.set(0, 0, 0)
  controls.update()
  hasSetCamera = false
  if (canLog()) {
    console.log('[Viewer] 相机位置已重置')
  }

  // 5. 重置边界数据
  minVertex.set(0, 0, 0)
  maxVertex.set(0, 0, 0)
  maxLong = 0
  maxWidth = 0
  maxHeight = 0
  if (canLog()) {
    console.log('[Viewer] 边界数据已重置')
  }

  // 6. 重新创建空的点云场景
  createPointCloud()
  if (canLog()) {
    console.log('[Viewer] 点云场景已重建')
  }

  // 7. 重新创建坐标轴、刻度尺
  createAxes()
  createScaleplate()
  if (canLog()) {
    console.log('[Viewer] 坐标轴和刻度尺已重建')
  }

  if (canLog()) {
    console.log('[Viewer] 重置完成')
  }
}

// 暴露重置方法给父组件
defineExpose({
  resetViewer
})

onUnmounted(() => {
  cancelAnimationFrame(animationId)
  window.removeEventListener('resize', handleResize)

  // 取消STOMP订阅
  if (deviceStore.currentDevice) {
    unsubscribe(deviceStore.currentDevice, 'status')
  }

  if (axesHelper) {
    scene.remove(axesHelper)
    axesHelper.dispose()
  }
  if (scaleplateHelper) {
    scene.remove(scaleplateHelper)
    scaleplateHelper.dispose()
  }
  if (footprintLine) {
    scene.remove(footprintLine)
    footprintLine.geometry.dispose()
    footprintLine.material.dispose()
  }
  if (locationGroup) {
    scene.remove(locationGroup)
    locationGroup.traverse(child => {
      if (child.geometry) child.geometry.dispose()
      if (child.material) child.material.dispose()
    })
  }
  if (pointCloudGroup) {
    scene.remove(pointCloudGroup)
  }
  // 释放所有帧的 geometry
  firstPersonFrames.forEach(frame => {
    if (frame.geometry) frame.geometry.dispose()
  })
  thirdPersonFrames.forEach(frame => {
    if (frame.geometry) frame.geometry.dispose()
  })
  firstPersonFrames = []
  thirdPersonFrames = []
  if (pointCloudMaterial) {
    pointCloudMaterial.dispose()
  }

  renderer.dispose()
})
</script>

<style scoped>
.viewer-container {
  width: 100%;
  height: 100%;
  position: relative;
}

.stats-container {
  position: absolute;
  top: 0;
  left: 0;
  z-index: 100;
  display: flex;
  flex-direction: column;
  gap: 0;
}

:deep(canvas) {
  display: block;
  background: radial-gradient(#223344, #001122) !important;
}
</style>
