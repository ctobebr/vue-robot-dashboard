import { defineStore } from 'pinia'
import { ref, watch } from 'vue'

const defaultAppearance = {
  collectionMode: 'demo',
  points: {
    size: 0.2,
    alpha: 0.5,
    shape: 'circle',
    sizeAttenuation: false,
    visible: true,
    height: [0, 100],
    reverse: false
  },
  scaleplate: {
    size: 10,
    alpha: 0.6,
    shape: 'grid',
    division: 10,
    color: '#00aa00',
    visible: true
  },
  axes: {
    size: 5,
    visible: true
  },
  footprint: {
    size: 1,
    alpha: 0.5,
    color: '#fa6400',
    visible: true
  },
  location: {
    size: 1,
    color: '#f00',
    visible: false
  }
}

const defaultCamera = {
  fov: 70,
  follow: false,
  followMode: 'position',
  isFirstPerson: false,
  offset: [0, 0, 0]
}

const defaultTools = {
  clip: {
    enabled: false,
    visible: true,
    position: [0, 0, 0],
    rotation: [0, 0, 0],
    scale: [1, 1, 1],
    inside: false
  },
  stats: {
    enabled: false
  }
}

// 机器人控制默认设置
const defaultRobotControl = {
  dogPose: 'Squat1004',
  sensorsEnabled: false,
  pointCloudDense: 'medium'
}

// 视频面板默认设置
const defaultVideoPanel = {
  minimized: true  // 默认最小化，按需加载视频
}

export const useSettingStore = defineStore('setting', () => {
  const appearance = ref({ ...defaultAppearance })
  const camera = ref({ ...defaultCamera })
  const tools = ref({ ...defaultTools })
  const robotControl = ref({ ...defaultRobotControl })
  const videoPanel = ref({ ...defaultVideoPanel })

  function setAppearance(newAppearance) {
    appearance.value = { ...appearance.value, ...newAppearance }
  }

  function setCamera(newCamera) {
    camera.value = { ...camera.value, ...newCamera }
  }

  function setTools(newTools) {
    tools.value = { 
      clip: { ...tools.value.clip, ...(newTools.clip || {}) },
      stats: { ...tools.value.stats, ...(newTools.stats || {}) }
    }
  }

  function setRobotControl(newRobotControl) {
    robotControl.value = { ...robotControl.value, ...newRobotControl }
  }

  function setVideoPanel(newVideoPanel) {
    videoPanel.value = { ...videoPanel.value, ...newVideoPanel }
  }

  function reset() {
    appearance.value = { ...defaultAppearance }
    camera.value = { ...defaultCamera }
    tools.value = { ...defaultTools }
    robotControl.value = { ...defaultRobotControl }
    videoPanel.value = { ...defaultVideoPanel }
  }

  const STORAGE_KEY = 'setting-storage'

  function loadFromStorage() {
    try {
      const stored = sessionStorage.getItem(STORAGE_KEY)
      if (stored) {
        const parsed = JSON.parse(stored)
        if (parsed.appearance) appearance.value = parsed.appearance
        if (parsed.camera) camera.value = parsed.camera
        if (parsed.tools) tools.value = parsed.tools
        if (parsed.robotControl) robotControl.value = parsed.robotControl
        if (parsed.videoPanel) videoPanel.value = parsed.videoPanel
      }
    } catch (e) {
      console.error('Failed to load settings from storage:', e)
    }
  }

  function saveToStorage() {
    try {
      const data = {
        appearance: appearance.value,
        camera: camera.value,
        tools: tools.value,
        robotControl: robotControl.value,
        videoPanel: videoPanel.value
      }
      sessionStorage.setItem(STORAGE_KEY, JSON.stringify(data))
    } catch (e) {
      console.error('Failed to save settings from storage:', e)
    }
  }

  watch([appearance, camera, tools, robotControl, videoPanel], () => {
    saveToStorage()
  }, { deep: true })

  loadFromStorage()

  return {
    appearance,
    camera,
    tools,
    robotControl,
    videoPanel,
    setAppearance,
    setCamera,
    setTools,
    setRobotControl,
    setVideoPanel,
    reset
  }
})
