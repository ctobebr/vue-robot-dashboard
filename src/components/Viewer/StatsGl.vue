<template>
  <div ref="statsContainer" class="stats-container" v-if="enabled"></div>
</template>

<script setup>
import { ref, onMounted, onUnmounted, watch, nextTick } from 'vue'

const props = defineProps({
  enabled: {
    type: Boolean,
    default: true
  },
  renderer: {
    type: Object,
    default: null
  }
})

const statsContainer = ref(null)
let stats = null
let isDestroyed = false
let isInitialized = false

class Panel {
  constructor(name, fg, bg) {
    this.name = name
    this.fg = fg
    this.bg = bg
    this.PR = Math.round(window.devicePixelRatio || 1)
    this.WIDTH = 90 * this.PR
    this.HEIGHT = 48 * this.PR
    this.TEXT_X = 3 * this.PR
    this.TEXT_Y = 2 * this.PR
    this.GRAPH_X = 3 * this.PR
    this.GRAPH_Y = 15 * this.PR
    this.GRAPH_WIDTH = 84 * this.PR
    this.GRAPH_HEIGHT = 30 * this.PR

    this.canvas = document.createElement('canvas')
    this.canvas.width = this.WIDTH
    this.canvas.height = this.HEIGHT
    this.canvas.style.cssText = `width:${90}px;height:${48}px;`
    
    this.ctx = this.canvas.getContext('2d', { alpha: false })
    this._initDraw()

    this.min = Infinity
    this.max = 0
  }

  _initDraw() {
    if (!this.ctx) return
    this.ctx.font = `bold ${9 * this.PR}px Helvetica, Arial, sans-serif`
    this.ctx.textBaseline = 'top'
    this.ctx.fillStyle = this.bg
    this.ctx.fillRect(0, 0, this.WIDTH, this.HEIGHT)
    this.ctx.fillStyle = this.fg
    this.ctx.fillText(this.name, this.TEXT_X, this.TEXT_Y)
    this.ctx.fillRect(this.GRAPH_X, this.GRAPH_Y, this.GRAPH_WIDTH, this.GRAPH_HEIGHT)
    this.ctx.fillStyle = this.bg
    this.ctx.globalAlpha = 0.9
    this.ctx.fillRect(this.GRAPH_X, this.GRAPH_Y, this.GRAPH_WIDTH, this.GRAPH_HEIGHT)
    this.ctx.globalAlpha = 1
  }

  update(value, valueGraph, maxValue, maxGraph, precision, forcedMin = null, forcedMax = null) {
    this.min = Math.min(this.min, value)
    this.max = Math.max(this.max, value)
    
    if (!this.ctx) return
    
    // 使用强制值（如果提供），否则使用计算值
    const displayMin = forcedMin !== null ? forcedMin : this.min
    const displayMax = forcedMax !== null ? forcedMax : this.max
    
    this.ctx.fillStyle = this.bg
    this.ctx.fillRect(0, 0, this.WIDTH, this.GRAPH_Y)
    this.ctx.fillStyle = this.fg
    const text = `${value.toFixed(precision)} ${this.name} (${displayMin.toFixed(precision)}-${displayMax.toFixed(precision)})`
    this.ctx.fillText(text, this.TEXT_X, this.TEXT_Y)

    this.ctx.drawImage(
      this.canvas,
      this.GRAPH_X + this.PR, this.GRAPH_Y,
      this.GRAPH_WIDTH - this.PR, this.GRAPH_HEIGHT,
      this.GRAPH_X, this.GRAPH_Y,
      this.GRAPH_WIDTH - this.PR, this.GRAPH_HEIGHT
    )

    this.ctx.fillStyle = this.fg
    this.ctx.fillRect(
      this.GRAPH_X + this.GRAPH_WIDTH - this.PR,
      this.GRAPH_Y,
      this.PR,
      this.GRAPH_HEIGHT
    )

    this.ctx.fillStyle = this.bg
    this.ctx.globalAlpha = 0.9
    const fillHeight = Math.max(0, Math.min(1, valueGraph / maxGraph)) * this.GRAPH_HEIGHT
    this.ctx.fillRect(
      this.GRAPH_X + this.GRAPH_WIDTH - this.PR,
      this.GRAPH_Y,
      this.PR,
      this.GRAPH_HEIGHT - fillHeight
    )
    this.ctx.globalAlpha = 1
  }
}

class Stats {
  constructor() {
    this.dom = document.createElement('div')
    this.dom.style.cssText = 'position:fixed;top:0;left:0;opacity:0.9;z-index:10000;'

    this.gl = null
    this.ext = null
    this.activeQuery = null
    this.gpuQueries = []

    this.isRunningCPUProfiling = false
    this.totalCpuDuration = 0
    this.totalGpuDuration = 0

    this.beginTime = performance.now()
    this.prevTime = this.beginTime
    this.prevCpuTime = this.beginTime
    this.frames = 0
    this.lastFps = 60

    // FPS 数据存储（用于图表滚动）
    this.fpsLogs = []
    this.fpsGraph = []

    this.averageCpu = { logs: [], graph: [] }
    this.averageGpu = { logs: [], graph: [] }

    this.samplesLog = 100
    this.samplesGraph = 10
    this.precision = 2
    this.logsPerSecond = 20

    this.fpsPanel = this._addPanel(new Panel('FPS', '#0ff', '#002'), 0)
    this.msPanel = this._addPanel(new Panel('CPU', '#0f0', '#020'), 1)
    this.gpuPanel = null
  }

  _addPanel(panel, offset) {
    if (panel.canvas) {
      this.dom.appendChild(panel.canvas)
      this._resizePanel(panel, offset)
    }
    return panel
  }

  _resizePanel(panel, offset) {
    panel.canvas.style.position = 'absolute'
    panel.canvas.style.display = 'block'
    panel.canvas.style.left = '0px'
    panel.canvas.style.top = `${offset * panel.HEIGHT / panel.PR}px`
  }

  init(gl) {
    if (!gl) return
    this.gl = gl
    this.ext = this.gl.getExtension('EXT_disjoint_timer_query_webgl2')
    if (this.ext) {
      this.gpuPanel = this._addPanel(new Panel('GPU', '#ff0', '#220'), 2)
    }
  }

  begin() {
    if (!this.isRunningCPUProfiling) {
      this._beginProfiling('cpu-started')
    }

    if (!this.gl || !this.ext) return

    if (this.activeQuery) {
      this.gl.endQuery(this.ext.TIME_ELAPSED_EXT)
    }

    this.activeQuery = this.gl.createQuery()
    if (this.activeQuery) {
      this.gl.beginQuery(this.ext.TIME_ELAPSED_EXT, this.activeQuery)
    }
  }

  end() {
    if (this.gl && this.ext && this.activeQuery) {
      this.gl.endQuery(this.ext.TIME_ELAPSED_EXT)
      this.gpuQueries.push({ query: this.activeQuery })
      this.activeQuery = null
    }
  }

  _processGpuQueries() {
    if (!this.gl || !this.ext) return
    this.totalGpuDuration = 0

    for (let i = this.gpuQueries.length - 1; i >= 0; i--) {
      const queryInfo = this.gpuQueries[i]
      const available = this.gl.getQueryParameter(queryInfo.query, this.gl.QUERY_RESULT_AVAILABLE)
      const disjoint = this.gl.getParameter(this.ext.GPU_DISJOINT_EXT)

      if (available && !disjoint) {
        const elapsed = this.gl.getQueryParameter(queryInfo.query, this.gl.QUERY_RESULT)
        this.totalGpuDuration += elapsed * 1e-6
        this.gl.deleteQuery(queryInfo.query)
        this.gpuQueries.splice(i, 1)
      }
    }
  }

  update() {
    this._processGpuQueries()
    this._endProfiling('cpu-started', 'cpu-finished', 'cpu-duration')

    this._addToAverage(this.totalCpuDuration, this.averageCpu)
    this._addToAverage(this.totalGpuDuration, this.averageGpu)

    this.totalCpuDuration = 0
    this.totalGpuDuration = 0

    this._updateDisplay()
  }

  _updateDisplay() {
    const time = performance.now()
    this.frames++

    // 每秒计算一次 FPS
    if (time >= this.prevTime + 1000) {
      this.lastFps = Math.round((this.frames * 1000) / (time - this.prevTime))
      this.prevTime = time
      this.frames = 0
    }

    // 每 50ms 更新一次所有面板（与 CPU/GPU 相同的频率）
    if (time >= this.prevCpuTime + 1000 / this.logsPerSecond) {
      // 添加 FPS 到数据数组
      this.fpsLogs.push(this.lastFps)
      if (this.fpsLogs.length > this.samplesLog) {
        this.fpsLogs.shift()
      }
      this.fpsGraph.push(this.lastFps)
      if (this.fpsGraph.length > this.samplesGraph) {
        this.fpsGraph.shift()
      }

      // 更新 FPS 面板
      this._updateFpsPanel()
      
      // 更新 CPU/GPU 面板
      this._updatePanel(this.msPanel, this.averageCpu)
      this._updatePanel(this.gpuPanel, this.averageGpu)
      
      this.prevCpuTime = time
    }
  }

  _updateFpsPanel() {
    // FPS 直接显示当前值
    const currentFps = this.lastFps
    
    // 计算图表用的平均值
    let sumGraph = 0
    for (const value of this.fpsGraph) {
      sumGraph += value
    }
    const avgGraph = this.fpsGraph.length > 0 ? sumGraph / this.fpsGraph.length : currentFps

    // 强制显示 60-100 的范围（与重构前一致）
    this.fpsPanel.update(currentFps, avgGraph, 100, 100, 0, 60, 100)
  }

  _addToAverage(value, averageArray) {
    averageArray.logs.push(value)
    if (averageArray.logs.length > this.samplesLog) {
      averageArray.logs.shift()
    }

    averageArray.graph.push(value)
    if (averageArray.graph.length > this.samplesGraph) {
      averageArray.graph.shift()
    }
  }

  _updatePanel(panel, averageArray) {
    if (!panel || averageArray.logs.length === 0) return

    let sumLog = 0
    let max = 0.01
    for (const value of averageArray.logs) {
      sumLog += value
      max = Math.max(max, value)
    }

    let sumGraph = 0
    let maxGraph = 0.01
    for (const value of averageArray.graph) {
      sumGraph += value
      maxGraph = Math.max(maxGraph, value)
    }

    const avgLog = sumLog / Math.min(averageArray.logs.length, this.samplesLog)
    const avgGraph = sumGraph / Math.min(averageArray.graph.length, this.samplesGraph)

    panel.update(avgLog, avgGraph, max, maxGraph, this.precision)
  }

  _beginProfiling(marker) {
    if (window.performance) {
      window.performance.mark(marker)
      this.isRunningCPUProfiling = true
    }
  }

  _endProfiling(startMarker, endMarker, measureName) {
    if (window.performance && this.isRunningCPUProfiling) {
      window.performance.mark(endMarker)
      const measure = performance.measure(measureName, startMarker, endMarker)
      this.totalCpuDuration += measure.duration
      this.isRunningCPUProfiling = false
    }
  }
}

function initStats() {
  if (isDestroyed || isInitialized) return
  
  cleanup()
  stats = new Stats()
  
  if (statsContainer.value) {
    statsContainer.value.appendChild(stats.dom)
  }
  
  nextTick(() => {
    _initWebGL()
  })
  
  isInitialized = true
}

function _initWebGL() {
  let gl = null
  
  if (props.renderer?.getContext) {
    gl = props.renderer.getContext()
  }
  
  if (!gl) {
    const canvas = document.querySelector('canvas')
    if (canvas) {
      gl = canvas.getContext('webgl2') || canvas.getContext('webgl')
    }
  }
  
  if (gl) {
    stats.init(gl)
    _patchRenderer()
  }
}

function _patchRenderer() {
  if (!props.renderer?.render || props.renderer._statsPatched) return
  
  props.renderer._statsPatched = true
  const originalRender = props.renderer.render.bind(props.renderer)
  
  props.renderer.render = function(scene, camera) {
    if (stats && !isDestroyed) {
      stats.begin()
      originalRender(scene, camera)
      stats.end()
      stats.update()
    } else {
      originalRender(scene, camera)
    }
  }
}

function cleanup() {
  isInitialized = false
  
  if (stats?.dom?.parentNode) {
    stats.dom.parentNode.removeChild(stats.dom)
  }
  
  stats = null
}

onMounted(() => {
  if (props.enabled && statsContainer.value) {
    initStats()
  }
})

onUnmounted(() => {
  isDestroyed = true
  cleanup()
})

watch(() => props.enabled, (enabled) => {
  if (enabled) {
    nextTick(() => {
      if (statsContainer.value) {
        initStats()
      }
    })
  } else {
    cleanup()
  }
})

watch(() => props.renderer, (newRenderer) => {
  if (newRenderer && props.enabled && statsContainer.value && !isInitialized) {
    nextTick(() => {
      initStats()
    })
  }
}, { immediate: true })
</script>

<style scoped>
.stats-container {
  position: absolute;
  top: 0;
  left: 0;
  z-index: 100;
}
</style>
