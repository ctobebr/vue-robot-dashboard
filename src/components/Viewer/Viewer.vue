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
import { ref, onMounted, onUnmounted, watch, nextTick } from 'vue'
import * as THREE from 'three'
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js'
import { load, registerLoaders, setLoaderOptions } from '@loaders.gl/core'
import { DracoLoader } from '@loaders.gl/draco'
import { useSettingStore } from '@/stores/setting'
import { useSocket } from '@/composables/useSocket'
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
const { socket } = useSocket()

const containerRef = ref(null)
const rendererRef = ref(null)
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
let pointCloudGroup = null
let pointCloudMaterial = null

let firstPoints = []
let thirdPoints = []
let latestPosition = null
let latestOrientation = null
let cameraTarget = new THREE.Vector3()
let hasSetCamera = false
let minVertex = new THREE.Vector3(0, 0, 0)
let maxVertex = new THREE.Vector3(0, 0, 0)
let maxLong = 0
let maxWidth = 0
let maxHeight = 0

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
  const geometry = new THREE.BufferGeometry().setFromPoints(footprintPoints)
  const material = new THREE.LineBasicMaterial({ color, linewidth: size })
  footprintLine = new THREE.Line(geometry, material)
  footprintLine.visible = visible
  scene.add(footprintLine)
}

function updateFootprint(point) {
  const lastPoint = footprintPoints[footprintPoints.length - 1]
  const distance = point.distanceTo(lastPoint)
  
  if (distance >= 0.1) {
    footprintPoints.push(point)
    if (footprintLine) {
      footprintLine.geometry.setFromPoints(footprintPoints)
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

function createPointCloud() {
  if (pointCloudGroup) {
    scene.remove(pointCloudGroup)
    pointCloudGroup.traverse(child => {
      if (child.geometry) child.geometry.dispose()
    })
  }
  
  pointCloudGroup = new THREE.Group()
  pointCloudGroup.up.set(0, 0, 1)
  scene.add(pointCloudGroup)
}

function renderPointClouds() {
  if (!pointCloudGroup || !pointCloudMaterial) return
  
  while (pointCloudGroup.children.length > 0) {
    const child = pointCloudGroup.children[0]
    pointCloudGroup.remove(child)
    if (child.geometry) child.geometry.dispose()
  }
  
  const points = settingStore.camera.isFirstPerson ? firstPoints : thirdPoints
  
  points.forEach((geometry, index) => {
    const pointsMesh = new THREE.Points(geometry, pointCloudMaterial)
    pointCloudGroup.add(pointsMesh)
  })
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
        camera.position.copy(latestPosition)
        cameraTarget.copy(target)
        camera.lookAt(cameraTarget)
        hasSetCamera = true
      }
    } else {
      if (follow) {
        camera.position.lerp(new THREE.Vector3(10, 10, 10), 0.1)
        cameraTarget.lerp(new THREE.Vector3(0, 0, 0), 0.1)
        camera.lookAt(cameraTarget)
      } else if (!hasSetCamera) {
        camera.position.set(10, 10, 10)
        cameraTarget.set(0, 0, 0)
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
}

function setupSocketListeners() {
  if (!socket.value) return
  
  let minX = 0, minY = 0, minZ = 0, maxX = 0, maxY = 0, maxZ = 0
  
  socket.value.on('PointCloud', (msg) => {
    load(msg, DracoLoader, { worker: false }).then((data) => {
      const { POSITION, COLOR_0 } = data.attributes
      const { vertexCount, boundingBox } = data.header
      
      if (minX > boundingBox[0][0]) minX = boundingBox[0][0]
      if (minY > boundingBox[0][1]) minY = boundingBox[0][1]
      if (minZ > boundingBox[0][2]) minZ = boundingBox[0][2]
      if (maxX < boundingBox[1][0]) maxX = boundingBox[1][0]
      if (maxY < boundingBox[1][1]) maxY = boundingBox[1][1]
      if (maxZ < boundingBox[1][2]) maxZ = boundingBox[1][2]
      
      minVertex.set(minX, minY, minZ)
      maxVertex.set(maxX, maxY, maxZ)
      maxLong = Math.abs(maxX) + Math.abs(minX)
      maxWidth = Math.abs(maxY) + Math.abs(minY)
      maxHeight = Math.abs(maxZ) + Math.abs(minZ)
      
      const geometry = new THREE.BufferGeometry()
      geometry.setAttribute('color', new THREE.BufferAttribute(COLOR_0.value, 3, true))
      geometry.setAttribute('position', new THREE.Float32BufferAttribute(POSITION.value, POSITION.size))
      
      if (firstPoints.length >= 100) {
        firstPoints.shift()
      }
      firstPoints.push(geometry)
      
      if (settingStore.appearance.collectionMode === 'work') {
        if (thirdPoints.length > 3000) {
          thirdPoints.shift()
        }
        thirdPoints.push(geometry)
      } else {
        thirdPoints.push(geometry)
      }
      
      renderPointClouds()
      updatePointCloudMaterial()
    })
  })
  
  socket.value.on('BaseStatus', (msg) => {
    const { position, orientation } = msg.currentPose
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
    renderPointClouds()
  }
)



watch(
  () => settingStore.appearance.collectionMode,
  (newMode) => {
    if (newMode === 'work') {
      if (thirdPoints.length > 3000) {
        thirdPoints = thirdPoints.slice(-3000)
      }
    }
    renderPointClouds()
  }
)

onUnmounted(() => {
  cancelAnimationFrame(animationId)
  window.removeEventListener('resize', handleResize)

  if (socket.value) {
    socket.value.off('PointCloud')
    socket.value.off('BaseStatus')
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
  if (clipVolumeGroup) {
    scene.remove(clipVolumeGroup)
    if (clipBox) {
      clipBox.geometry.dispose()
      clipBox.material.dispose()
    }
  }
  if (transformControls) {
    scene.remove(transformControls)
    transformControls.dispose()
  }
  if (pointCloudGroup) {
    scene.remove(pointCloudGroup)
    pointCloudGroup.traverse(child => {
      if (child.geometry) child.geometry.dispose()
    })
  }
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
