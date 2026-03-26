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
    alpha: 0.3,
    shape: 'grid',
    division: 10,
    color: '#00ff00',
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

export const useSettingStore = defineStore('setting', () => {
  const appearance = ref({ ...defaultAppearance })
  const camera = ref({ ...defaultCamera })
  const tools = ref({ ...defaultTools })

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

  function reset() {
    appearance.value = { ...defaultAppearance }
    camera.value = { ...defaultCamera }
    tools.value = { ...defaultTools }
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
        tools: tools.value
      }
      sessionStorage.setItem(STORAGE_KEY, JSON.stringify(data))
    } catch (e) {
      console.error('Failed to save settings to storage:', e)
    }
  }

  watch([appearance, camera, tools], () => {
    saveToStorage()
  }, { deep: true })

  loadFromStorage()

  return {
    appearance,
    camera,
    tools,
    setAppearance,
    setCamera,
    setTools,
    reset
  }
})
