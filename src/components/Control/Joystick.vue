<template>
  <div class="joystick-container" :class="{ active: isActive }">
    
    <!-- 状态显示 -->
    <div class="joystick-status" v-if="showStatus">
      <div class="status-item">
        <span class="label">方向:</span>
        <span class="value">{{ directionText }}</span>
      </div>
      <div class="status-item">
        <span class="label">力度:</span>
        <span class="value">{{ Math.round(strength * 100) }}%</span>
      </div>
    </div>

    <!-- 控制台日志 -->
    <div class="joystick-log" v-if="showStatus">
      <div class="log-header">控制台</div>
      <div class="log-content" ref="logContentRef">
        <div v-for="(message, index) in logMessages" :key="index" class="log-message">
          {{ message }}
        </div>
      </div>
    </div>
    <div class="joystick-pad" ref="containerRef">
      <div class="joystick-wrapper" ref="joystickWrapper">
        <div class="joystick-base"></div>
        <div
          class="joystick-knob"
          ref="joystickKnob"
          @mousedown="handleMouseDown"
        ></div>

        <div class="direction-btn up" :class="{ active: currentDirection === 'up' }" @mousedown.stop="handleDirectionKeyDown('up')" @mouseup.stop="handleDirectionKeyUp" @touchstart.stop.prevent="handleDirectionKeyDown('up')" @touchend.stop.prevent="handleDirectionKeyUp">
          <el-icon><ArrowUp /></el-icon>
        </div>

        <div class="direction-btn left" :class="{ active: currentDirection === 'left' }" @mousedown.stop="handleDirectionKeyDown('left')" @mouseup.stop="handleDirectionKeyUp" @touchstart.stop.prevent="handleDirectionKeyDown('left')" @touchend.stop.prevent="handleDirectionKeyUp">
          <el-icon><ArrowLeft /></el-icon>
        </div>

        <div class="direction-btn right" :class="{ active: currentDirection === 'right' }" @mousedown.stop="handleDirectionKeyDown('right')" @mouseup.stop="handleDirectionKeyUp" @touchstart.stop.prevent="handleDirectionKeyDown('right')" @touchend.stop.prevent="handleDirectionKeyUp">
          <el-icon><ArrowRight /></el-icon>
        </div>

        <div class="direction-btn down" :class="{ active: currentDirection === 'down' }" @mousedown.stop="handleDirectionKeyDown('down')" @mouseup.stop="handleDirectionKeyUp" @touchstart.stop.prevent="handleDirectionKeyDown('down')" @touchend.stop.prevent="handleDirectionKeyUp">
          <el-icon><ArrowDown /></el-icon>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, computed, onMounted, onUnmounted, watch, onBeforeUnmount, nextTick } from 'vue'
import { ArrowUp, ArrowDown, ArrowLeft, ArrowRight } from '@element-plus/icons-vue'
import { ElIcon } from 'element-plus'
import { getMultiTouch, setupGlobalMultiTouchListeners } from '@/composables/useMultiTouch'

/**
 * @typedef {Object} JoystickProps
 * @property {number} [size=120] 摇杆底座尺寸（像素）
 * @property {boolean} [showDirectionKeys=true] 是否显示方向按键
 * @property {string} [color='#409eff'] 摇杆激活状态颜色
 * @property {boolean} [showStatus=false] 是否显示状态信息
 * @property {'slow'|'normal'|'fast'} [speedMode='normal'] 速度模式
 * @property {string} [joystickId='default'] 摇杆唯一标识符
 */

/**
 * @typedef {Object} Direction
 * @property {number} x X轴方向值（-1到1）
 * @property {number} y Y轴方向值（-1到1）
 * @property {number} strength 力度值（0到1）
 */

/**
 * @typedef {Object} Position
 * @property {number} x X轴偏移量（像素）
 * @property {number} y Y轴偏移量（像素）
 */

/**
 * @typedef {Object} CalculatedPosition
 * @property {number} x X轴偏移量（像素）
 * @property {number} y Y轴偏移量（像素）
 * @property {number} distance 归一化距离（0到1）
 */

const props = defineProps(/** @type {JoystickProps} */ ({
  size: {
    type: Number,
    default: 120
  },
  showDirectionKeys: {
    type: Boolean,
    default: true
  },
  color: {
    type: String,
    default: '#409eff'
  },
  showStatus: {
    type: Boolean,
    default: false
  },
  speedMode: {
    type: String,
    default: 'normal',
    validator: (value) => ['slow', 'normal', 'fast'].includes(value)
  },
  joystickId: {
    type: String,
    default: 'default'
  }
}))

/**
 * 触发移动事件
 * @event move
 * @type {{x: number, y: number, strength: number, source: 'joystick'|'key'}}
 */

/**
 * 触发停止事件
 * @event stop
 */

const emit = defineEmits(['move', 'stop'])

const containerRef = ref(null)
const joystickWrapper = ref(null)
const joystickKnob = ref(null)
const logContentRef = ref(null)
const isActive = ref(false)
const position = ref(/** @type {Position} */ ({ x: 0, y: 0 }))
const isDragging = ref(false)
const direction = ref(/** @type {Direction} */({ x: 0, y: 0, strength: 0 }))
const logMessages = ref([])
const directionKeyInterval = ref(null)
const resetInterval = ref(null)
const currentDirection = ref('')

/**
 * 控制模式：'joystick' | 'key'
 * - joystick: 摇杆拖拽模式，摇杆头跟随移动
 * - key: 方向键模式，摇杆头保持中心位置，仅发送指令
 */
const controlMode = ref('joystick')

const lastSendTime = ref(0)
const lastDirection = ref(/** @type {Direction} */({ x: 0, y: 0, strength: 0 }))
const lastCommandTime = ref(Date.now())
const heartbeatInterval = ref(null)
const isAutoStopEnabled = ref(true)
const sendInterval = ref(null)

const activeTouchId = ref(null)

/**
 * 摇杆配置对象
 * @property {Object} joystick 摇杆模式配置
 * @property {number} joystick.maxFrequency 最大发送频率（Hz）
 * @property {number} joystick.minInterval 最小发送间隔（毫秒）
 * @property {Object} joystick.threshold 变化阈值
 * @property {number} joystick.threshold.x X轴变化阈值
 * @property {number} joystick.threshold.y Y轴变化阈值
 * @property {number} joystick.threshold.strength 力度变化阈值
 * @property {Object} key 方向键模式配置
 * @property {number} key.maxFrequency 方向键最大频率（Hz）
 * @property {number} key.minInterval 方向键最小间隔（毫秒）
 * @property {number} key.fixedSpeed 方向键固定速度
 * @property {Object} safety 安全机制配置
 * @property {number} safety.autoStopDelay 自动停止延迟（毫秒）
 * @property {number} safety.heartbeatInterval 心跳检测间隔（毫秒）
 */
const config = {
  joystick: {
    maxFrequency: 25,
    minInterval: 40,  // 摇杆拖动最多 约25次/秒
    threshold: {
      x: 0.05,
      y: 0.05,
      strength: 0.03
    }
  },
  key: {
    maxFrequency: 12,
    minInterval: 83,  //  方向键长按最多 约12次/秒
    fixedSpeed: 0.6
  },
  safety: {
    autoStopDelay: 500,
    heartbeatInterval: 200
  }
}

/**
 * 速度模式映射表
 * @type {Object.<string, number>}
 */
const speedMappings = {
  slow: 0.3,
  normal: 0.6,
  fast: 1.0
}

watch([position, isActive], () => {
  updateKnobStyle()
}, { deep: true })

/**
 * 根据当前方向计算显示文本
 * @returns {string} 方向文本（'上'、'下'、'左'、'右'）
 */
const directionText = computed(() => {
  const { x, y } = direction.value
  if (Math.abs(x) > Math.abs(y)) {
    return x > 0 ? '右' : '左'
  } else {
    return y > 0 ? '下' : '上'
  }
})

/**
 * 获取当前摇杆力度值
 * @returns {number} 力度值（0到1）
 */
const strength = computed(() => {
  return direction.value.strength
})

/**
 * 发送当前摇杆方向数据
 * 根据配置的最短间隔限制发送频率，避免过于频繁的数据传输
 * @returns {void}
 * @throws {Error} 当摇杆未处于拖拽状态时不执行任何操作
 */
function sendCurrentDirection() {
  if (!isDragging.value) return

  const now = Date.now()
  if (now - lastSendTime.value >= config.joystick.minInterval) {
    const directionWithSource = {
      ...direction.value,
      source: 'joystick'
    }
    emit('move', directionWithSource)
    lastSendTime.value = now
    lastCommandTime.value = now
    addLog(`摇杆移动 (${directionText.value})`)
  }
}

/**
 * 更新摇杆旋钮的视觉位置和颜色
 * 根据当前position和isActive状态应用相应的CSS样式
 * @returns {void}
 */
function updateKnobStyle() {
  if (joystickKnob.value) {
    // 方向键模式下，摇杆头保持在中心位置
    const x = controlMode.value === 'key' ? 0 : position.value.x
    const y = controlMode.value === 'key' ? 0 : position.value.y
    joystickKnob.value.style.transform = `translate(calc(-50% + ${x}px), calc(-50% + ${y}px))`
    joystickKnob.value.style.backgroundColor = isActive.value ? props.color : '#666'
  }
}

/**
 * 根据触摸/鼠标位置计算摇杆偏移量
 * @param {number} clientX 客户端X坐标
 * @param {number} clientY 客户端Y坐标
 * @returns {CalculatedPosition} 包含x、y偏移量和归一化距离的对象
 * @throws {Error} 当摇杆容器元素不存在时返回零点坐标
 */
function calculatePosition(clientX, clientY) {
  if (!joystickWrapper.value) {
    return { x: 0, y: 0, distance: 0 }
  }

  const rect = joystickWrapper.value.getBoundingClientRect()
  const centerX = rect.width / 2
  const centerY = rect.height / 2

  let x = clientX - rect.left - centerX
  let y = clientY - rect.top - centerY

  const distance = Math.sqrt(x * x + y * y)
  const maxDistance = centerX * 0.8

  if (distance > maxDistance) {
    const angle = Math.atan2(y, x)
    x = Math.cos(angle) * maxDistance
    y = Math.sin(angle) * maxDistance
  }

  return { x, y, distance: Math.min(distance, maxDistance) / maxDistance }
}

/**
 * 更新摇杆位置和方向数据
 * 根据新的触摸/鼠标位置计算并更新position和direction
 * @param {number} clientX 客户端X坐标
 * @param {number} clientY 客户端Y坐标
 * @returns {void}
 */
function updatePosition(clientX, clientY) {
  const pos = calculatePosition(clientX, clientY)
  position.value = { x: pos.x, y: pos.y }

  const rawDirection = {
    x: pos.x / (props.size / 2),
    y: pos.y / (props.size / 2),
    strength: pos.distance
  }

  const speedMultiplier = speedMappings[props.speedMode]
  const newDirection = {
    x: rawDirection.x * speedMultiplier,
    y: rawDirection.y * speedMultiplier,
    strength: rawDirection.strength * speedMultiplier
  }

  direction.value = newDirection
  isAutoStopEnabled.value = true
}

/**
 * 处理鼠标按下事件，开始拖拽摇杆
 * @param {MouseEvent} event 鼠标事件对象
 * @returns {void}
 */
function handleMouseDown(event) {
  event.preventDefault()
  // 如果当前是方向键模式，先停止方向键控制
  if (controlMode.value === 'key') {
    handleDirectionKeyUp()
  }
  controlMode.value = 'joystick'
  isActive.value = true
  isDragging.value = true
  lastSendTime.value = 0
  updatePosition(event.clientX, event.clientY)
  sendInterval.value = setInterval(sendCurrentDirection, config.joystick.minInterval)
  addLog('摇杆激活')

  document.addEventListener('mousemove', handleMouseMove)
  document.addEventListener('mouseup', handleMouseUp)
}

/**
 * 处理鼠标移动事件，更新摇杆位置
 * @param {MouseEvent} event 鼠标事件对象
 * @returns {void}
 */
function handleMouseMove(event) {
  if (isDragging.value) {
    updatePosition(event.clientX, event.clientY)
  }
}

/**
 * 处理鼠标释放事件，复位摇杆
 * @returns {void}
 */
function handleMouseUp() {
  if (isDragging.value) {
    document.removeEventListener('mousemove', handleMouseMove)
    document.removeEventListener('mouseup', handleMouseUp)
    resetPosition()
    addLog('摇杆释放')
  }
}

/**
 * 检查触摸点是否在摇杆底座圆形区域内
 * @param {number} clientX 客户端X坐标
 * @param {number} clientY 客户端Y坐标
 * @returns {boolean} 是否在圆形区域内
 */
function isTouchInJoystickBase(clientX, clientY) {
  if (!joystickWrapper.value) return false

  const rect = joystickWrapper.value.getBoundingClientRect()
  const centerX = rect.left + rect.width / 2
  const centerY = rect.top + rect.height / 2
  const radius = rect.width / 2

  const distance = Math.sqrt(
    Math.pow(clientX - centerX, 2) + Math.pow(clientY - centerY, 2)
  )

  // 允许稍微超出边界（1.2倍半径），提高容错性
  return distance <= radius * 1.2
}

/**
 * 处理托管触摸开始事件
 * @param {Touch} touch 触摸事件对象
 * @returns {void}
 */
function handleManagedTouchStart(touch) {
  if (activeTouchId.value !== null) return

  // 检查触摸点是否在摇杆底座圆形区域内
  if (!isTouchInJoystickBase(touch.clientX, touch.clientY)) {
    return
  }

  // 如果当前是方向键模式，先停止方向键控制
  if (controlMode.value === 'key') {
    handleDirectionKeyUp()
  }
  controlMode.value = 'joystick'
  activeTouchId.value = touch.identifier
  isActive.value = true
  isDragging.value = true
  lastSendTime.value = 0
  updatePosition(touch.clientX, touch.clientY)
  sendInterval.value = setInterval(sendCurrentDirection, config.joystick.minInterval)
  addLog(`摇杆激活 (托管触摸) ID:${touch.identifier}`)
}

/**
 * 处理托管触摸移动事件
 * @param {Touch} touch 触摸事件对象
 * @returns {void}
 */
function handleManagedTouchMove(touch) {
  if (activeTouchId.value === null) return
  updatePosition(touch.clientX, touch.clientY)
}

/**
 * 处理托管触摸结束事件
 * @param {Touch} touch 触摸事件对象
 * @returns {void}
 */
function handleManagedTouchEnd(touch) {
  if (activeTouchId.value !== null) {
    resetPosition()
    activeTouchId.value = null
    addLog('摇杆释放 (托管触摸)')
  }
}

/**
 * 检查心跳状态，触发自动停止
 * 当摇杆超过指定时间未收到指令时自动发送stop事件
 * @returns {void}
 */
function checkHeartbeat() {
  const now = Date.now()
  if (!isDragging.value && isAutoStopEnabled.value && now - lastCommandTime.value > config.safety.autoStopDelay) {
    direction.value = { x: 0, y: 0, strength: 0 }
    emit('stop')
    addLog('自动停止（超时）')
    isAutoStopEnabled.value = false
  }
}

/**
 * 复位摇杆到初始状态
 * 立即将摇杆回归中心位置
 * @returns {void}
 */
function resetPosition() {
  isActive.value = false
  isDragging.value = false

  if (sendInterval.value) {
    clearInterval(sendInterval.value)
    sendInterval.value = null
  }

  if (resetInterval.value) {
    clearInterval(resetInterval.value)
    resetInterval.value = null
  }

  position.value = { x: 0, y: 0 }

  direction.value = { x: 0, y: 0, strength: 0 }
  emit('stop')
  lastCommandTime.value = Date.now()
  addLog('摇杆回正')
}

/**
 * 处理方向键按下事件
 * @param {'up'|'down'|'left'|'right'} dir 方向
 * @returns {void}
 */
function handleDirectionKeyDown(dir) {
  // 如果当前是摇杆拖拽模式，先停止摇杆控制
  if (controlMode.value === 'joystick' && isDragging.value) {
    resetPosition()
  }
  controlMode.value = 'key'
  currentDirection.value = dir

  handleDirectionKey(dir)

  directionKeyInterval.value = setInterval(() => {
    if (currentDirection.value === dir) {
      handleDirectionKey(dir)
    }
  }, config.key.minInterval)

  addLog(`方向键 ${dir} 按下`)
}

/**
 * 处理方向键释放事件
 * @returns {void}
 */
function handleDirectionKeyUp() {
  if (directionKeyInterval.value) {
    clearTimeout(directionKeyInterval.value)
    clearInterval(directionKeyInterval.value)
    directionKeyInterval.value = null
  }

  if (currentDirection.value) {
    addLog(`方向键 ${currentDirection.value} 释放`)
    currentDirection.value = ''
  }

  position.value = { x: 0, y: 0 }
  if (!isDragging.value) {
    isActive.value = false
  }
  direction.value = { x: 0, y: 0, strength: 0 }

  updateKnobStyle()

  emit('stop')
  lastCommandTime.value = Date.now()
  addLog('方向键回正')
}

/**
 * 根据方向键输入计算并发送方向数据
 * @param {'up'|'down'|'left'|'right'} dir 方向
 * @returns {void}
 */
function handleDirectionKey(dir) {
  if (currentDirection.value !== dir) {
    return
  }

  let x = 0
  let y = 0

  switch (dir) {
    case 'up':
      y = -1
      break
    case 'down':
      y = 1
      break
    case 'left':
      x = -1
      break
    case 'right':
      x = 1
      break
  }

  const speedMultiplier = speedMappings[props.speedMode]
  const outputSpeed = config.key.fixedSpeed * speedMultiplier

  // 方向键模式下，不修改 position（摇杆头保持在中心），只发送指令
  // position.value 保持 { x: 0, y: 0 }

  isActive.value = true

  const fixedSpeed = outputSpeed

  const newDirection = {
    x: x * fixedSpeed,
    y: y * fixedSpeed,
    strength: fixedSpeed
  }

  direction.value = newDirection
  isAutoStopEnabled.value = true

  const directionWithSource = {
    ...newDirection,
    source: 'key'
  }

  emit('move', directionWithSource)
  lastDirection.value = { ...newDirection }
  lastCommandTime.value = Date.now()

  addLog(`方向键 ${dir} 触发`)
}

/**
 * 添加日志消息到显示列表
 * @param {string} message 日志内容
 * @returns {void}
 */
function addLog(message) {
  if (!props.showStatus) return
  const timestamp = new Date().toLocaleTimeString()
  logMessages.value.push(`[${timestamp}] ${message}`)

  if (logMessages.value.length > 10) {
    logMessages.value.shift()
  }

  nextTick(() => {
    if (logContentRef.value) {
      logContentRef.value.scrollTop = logContentRef.value.scrollHeight
    }
  })
}

let multiTouch = null

onMounted(() => {
  setupGlobalMultiTouchListeners()
  multiTouch = getMultiTouch()

  lastCommandTime.value = Date.now()

  heartbeatInterval.value = setInterval(checkHeartbeat, config.safety.heartbeatInterval)

  updateKnobStyle()

  if (multiTouch && joystickWrapper.value) {
    multiTouch.registerJoystick(props.joystickId, joystickWrapper.value, {
      onTouchStart: handleManagedTouchStart,
      onTouchMove: handleManagedTouchMove,
      onTouchEnd: handleManagedTouchEnd
    })
  }

  addLog('摇杆初始化完成')
})

onBeforeUnmount(() => {
  if (multiTouch) {
    multiTouch.unregisterJoystick(props.joystickId)
  }
})

onUnmounted(() => {
  document.removeEventListener('mousemove', handleMouseMove)
  document.removeEventListener('mouseup', handleMouseUp)

  if (directionKeyInterval.value) {
    clearInterval(directionKeyInterval.value)
  }

  if (resetInterval.value) {
    clearInterval(resetInterval.value)
  }

  if (sendInterval.value) {
    clearInterval(sendInterval.value)
  }

  if (heartbeatInterval.value) {
    clearInterval(heartbeatInterval.value)
  }
})
</script>

<style scoped>
.joystick-container {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 12px;
  z-index: 100;
  user-select: none;
}

.joystick-pad {
  position: relative;
  width: calc(v-bind(size) * 2px);
  height: calc(v-bind(size) * 2px);
  display: flex;
  align-items: center;
  justify-content: center;
}

.direction-btn {
  position: absolute;
  width: calc(v-bind(size) * 0.4px);
  height: calc(v-bind(size) * 0.4px);
  background: transparent;
  border: none;
  box-shadow: none;
  display: flex;
  align-items: center;
  justify-content: center;
  cursor: pointer;
  transition: all 0.2s ease;
}

.direction-btn:hover {
  transform: translateX(-50%) translateY(-2px);
}

.direction-btn:active,
.direction-btn.active {
  transform: translateX(-50%) scale(0.95);
}

.direction-btn.left:hover {
  transform: translateY(-50%) translateX(-2px);
}

.direction-btn.left:active,
.direction-btn.left.active {
  transform: translateY(-50%) scale(0.95);
}

.direction-btn.right:hover {
  transform: translateY(-50%) translateX(2px);
}

.direction-btn.right:active,
.direction-btn.right.active {
  transform: translateY(-50%) scale(0.95);
}

.direction-btn.down:hover {
  transform: translateX(-50%) translateY(2px);
}

.direction-btn.down:active,
.direction-btn.down.active {
  transform: translateX(-50%) scale(0.95);
}

.direction-btn.up {
  top: 0;
  left: 50%;
  transform: translateX(-50%);
}

.direction-btn.left {
  left: 0;
  top: 50%;
  transform: translateY(-50%);
}

.direction-btn.right {
  right: 0;
  top: 50%;
  transform: translateY(-50%);
}

.direction-btn.down {
  bottom: 0;
  left: 50%;
  transform: translateX(-50%);
}
/* 适配修改 */
.joystick-wrapper {
  position: relative;
  width: calc(v-bind(size) * 1.2px);
  height: calc(v-bind(size) * 1.2px);
  cursor: grab;
  touch-action: none;
}

.joystick-wrapper:active {
  cursor: grabbing;
}

.joystick-base {
  position: absolute;
  top: 0;
  left: 0;
  width: 100%;
  height: 100%;
  border-radius: 50%;
  background: radial-gradient(circle at 30% 30%, rgba(255, 255, 255, 0.2), rgba(255, 255, 255, 0.05));
  backdrop-filter: blur(15px);
  border: 2px solid rgba(255, 255, 255, 0.2);
  transition: all 0.2s ease;
  box-shadow: 0 4px 16px rgba(0, 0, 0, 0.4), inset 0 1px 0 rgba(255, 255, 255, 0.1);
}

.joystick-container.active .joystick-base {
  background: radial-gradient(circle at 30% 30%, rgba(64, 158, 255, 0.3), rgba(64, 158, 255, 0.1));
  border-color: v-bind(color);
  box-shadow: 0 4px 20px rgba(64, 158, 255, 0.4), inset 0 1px 0 rgba(255, 255, 255, 0.1);
}

.joystick-knob {
  position: absolute;
  top: 50%;
  left: 50%;
  width: 40%;
  height: 40%;
  border-radius: 50%;
  background-color: #666;
  transform: translate(-50%, -50%);
  transition: all 0.1s ease;
  box-shadow: 0 3px 10px rgba(0, 0, 0, 0.4), inset 0 1px 0 rgba(255, 255, 255, 0.2);
  user-select: none;
  touch-action: none;
}

.joystick-container.active .joystick-knob {
  background-color: v-bind(color);
  box-shadow: 0 3px 15px rgba(64, 158, 255, 0.6), inset 0 1px 0 rgba(255, 255, 255, 0.3);
}

.joystick-status {
  display: flex;
  gap: 16px;
  padding: 8px 16px;
  background: rgba(0, 0, 0, 0.5);
  border-radius: 20px;
  border: 1px solid rgba(255, 255, 255, 0.1);
  backdrop-filter: blur(10px);
}

.status-item {
  display: flex;
  align-items: center;
  gap: 6px;
  font-size: 12px;
}

.status-item .label {
  color: #999;
}

.status-item .value {
  color: #fff;
  font-weight: 500;
}

.joystick-log {
  width: 240px;
  background: rgba(0, 0, 0, 0.7);
  border-radius: 8px;
  border: 1px solid rgba(255, 255, 255, 0.1);
  backdrop-filter: blur(10px);
  overflow: hidden;
}

.log-header {
  padding: 8px 12px;
  background: rgba(255, 255, 255, 0.05);
  border-bottom: 1px solid rgba(255, 255, 255, 0.1);
  font-size: 12px;
  font-weight: 500;
  color: #fff;
}

.log-content {
  max-height: 120px;
  overflow-y: auto;
  padding: 8px;
}

.log-message {
  font-size: 11px;
  color: #ccc;
  margin-bottom: 4px;
  line-height: 1.3;
}

@media screen and (max-width: 768px) {
  .joystick-pad {
    width: calc(v-bind(size) * 1.6px);
    height: calc(v-bind(size) * 1.6px);
  }

  .direction-btn {
    width: calc(v-bind(size) * 0.32px);
    height: calc(v-bind(size) * 0.32px);
  }

  .direction-btn.up {
    top: 0;
  }

  .direction-btn.left {
    left: 0;
  }

  .direction-btn.right {
    right: 0;
  }

  .direction-btn.down {
    bottom: 0;
  }

  .joystick-wrapper {
    width: calc(v-bind(size) * 1.4px);
    height: calc(v-bind(size) * 1.4px);
  }

  .joystick-status {
    gap: 12px;
    padding: 6px 12px;
  }

  .joystick-log {
    width: 200px;
  }

  .log-content {
    max-height: 100px;
  }
}

@media screen and (max-width: 480px) {
  .joystick-pad {
    width: calc(v-bind(size) * 1.4px);
    height: calc(v-bind(size) * 1.4px);
  }

  .direction-btn {
    width: calc(v-bind(size) * 0.28px);
    height: calc(v-bind(size) * 0.28px);
  }

  .direction-btn.up {
    top: 0;
  }

  .direction-btn.left {
    left: 0;
  }

  .direction-btn.right {
    right: 0;
  }

  .direction-btn.down {
    bottom: 0;
  }

  .joystick-wrapper {
    width: calc(v-bind(size) * 1.2px);
    height: calc(v-bind(size) * 1.2px);
  }

  .joystick-status {
    gap: 8px;
    padding: 4px 8px;
    font-size: 10px;
  }

  .joystick-log {
    width: 160px;
  }

  .log-content {
    max-height: 80px;
  }

  .log-message {
    font-size: 10px;
  }
}
</style>
