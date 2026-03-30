<template>
  <div class="joystick-container" :class="{ active: isActive }">
    <!-- 十字键布局 -->
    <div class="joystick-pad">
      <!-- 上箭头 -->
      <div class="direction-btn up" @mousedown="handleDirectionKeyDown('up')" @mouseup="handleDirectionKeyUp" @touchstart="handleDirectionKeyDown('up')" @touchend="handleDirectionKeyUp">
        <el-icon><ArrowUp /></el-icon>
      </div>
      
      <!-- 左箭头 -->
      <div class="direction-btn left" @mousedown="handleDirectionKeyDown('left')" @mouseup="handleDirectionKeyUp" @touchstart="handleDirectionKeyDown('left')" @touchend="handleDirectionKeyUp">
        <el-icon><ArrowLeft /></el-icon>
      </div>
      
      <!-- 摇杆 -->
      <div class="joystick-wrapper" ref="joystickWrapper">
        <div class="joystick-base"></div>
        <div 
          class="joystick-knob" 
          ref="joystickKnob"
          @mousedown="handleMouseDown"
          @touchstart="handleTouchStart"
        ></div>
      </div>
      
      <!-- 右箭头 -->
      <div class="direction-btn right" @mousedown="handleDirectionKeyDown('right')" @mouseup="handleDirectionKeyUp" @touchstart="handleDirectionKeyDown('right')" @touchend="handleDirectionKeyUp">
        <el-icon><ArrowRight /></el-icon>
      </div>
      
      <!-- 下箭头 -->
      <div class="direction-btn down" @mousedown="handleDirectionKeyDown('down')" @mouseup="handleDirectionKeyUp" @touchstart="handleDirectionKeyDown('down')" @touchend="handleDirectionKeyUp">
        <el-icon><ArrowDown /></el-icon>
      </div>
    </div>
    
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
    <div class="joystick-log" v-if="showStatus && logMessages.length > 0">
      <div class="log-header">控制台</div>
      <div class="log-content">
        <div v-for="(message, index) in logMessages" :key="index" class="log-message">
          {{ message }}
        </div>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, computed, onMounted, onUnmounted, watch } from 'vue'
import { ArrowUp, ArrowDown, ArrowLeft, ArrowRight } from '@element-plus/icons-vue'
import { ElIcon } from 'element-plus'

const props = defineProps({
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
  }
})

// 频率控制配置对象
const config = {
  // 摇杆拖拽配置
  joystick: {
    maxFrequency: 25, // 最高25次/秒
    minInterval: 40, // 最小间隔40ms
    threshold: {
      x: 0.05, // x变化超过0.05才发送
      y: 0.05, // y变化超过0.05才发送
      strength: 0.03 // 力度变化超过0.03才发送
    }
  },
  // 方向键配置
  key: {
    maxFrequency: 12, // 最高12次/秒
    minInterval: 83, // 最小间隔83ms
    fixedSpeed: 0.6 // 固定速度0.6
  },
  // 安全保护配置
  safety: {
    autoStopDelay: 500, // 500ms无指令自动停止
    heartbeatInterval: 200 // 每200ms检查一次
  }
}

// 速度档位映射
const speedMappings = {
  slow: 0.3, // 0.3倍速度
  normal: 0.6, // 0.6倍速度
  fast: 1.0 // 1.0倍速度
}

const emit = defineEmits(['move', 'stop'])

const joystickWrapper = ref(null)
const joystickKnob = ref(null)
const isActive = ref(false)
const position = ref({ x: 0, y: 0 })
const isDragging = ref(false)
const direction = ref({ x: 0, y: 0, strength: 0 })
const logMessages = ref([])
const directionKeyInterval = ref(null)
const resetInterval = ref(null)
const currentDirection = ref('')

// 频率控制变量
const lastSendTime = ref(0) // 上次发送时间
const lastDirection = ref({ x: 0, y: 0, strength: 0 }) // 上次发送的方向和力度
const lastCommandTime = ref(Date.now()) // 最后一次发送指令的时间
const heartbeatInterval = ref(null) // 心跳检测定时器
const isAutoStopEnabled = ref(true) // 自动停止是否启用
const sendInterval = ref(null) // 发送定时器

// 监听 position 和 isActive 变化，自动更新摇杆样式
watch([position, isActive], () => {
  updateKnobStyle()
}, { deep: true })

// 计算方向文本
const directionText = computed(() => {
  const { x, y } = direction.value
  if (Math.abs(x) > Math.abs(y)) {
    return x > 0 ? '右' : '左'
  } else {
    return y > 0 ? '下' : '上'
  }
})

// 计算力度
const strength = computed(() => {
  return direction.value.strength
})

// 持续发送当前方向（模式B：固定频率发送）
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
  }
}

// 直接更新摇杆样式
function updateKnobStyle() {
  if (joystickKnob.value) {
    joystickKnob.value.style.transform = `translate(calc(-50% + ${position.value.x}px), calc(-50% + ${position.value.y}px))`
    joystickKnob.value.style.backgroundColor = isActive.value ? props.color : '#666'
  }
}

// 计算位置
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

// 鼠标按下
function handleMouseDown(event) {
  event.preventDefault()
  isActive.value = true
  isDragging.value = true
  // 重置发送时间，确保立即发送
  lastSendTime.value = 0
  updatePosition(event.clientX, event.clientY)
  // 启动持续发送定时器
  sendInterval.value = setInterval(sendCurrentDirection, config.joystick.minInterval)
  addLog('摇杆激活')
}

// 触摸开始
function handleTouchStart(event) {
  event.preventDefault()
  isActive.value = true
  isDragging.value = true
  // 重置发送时间，确保立即发送
  lastSendTime.value = 0
  const touch = event.touches[0]
  updatePosition(touch.clientX, touch.clientY)
  // 启动持续发送定时器
  sendInterval.value = setInterval(sendCurrentDirection, config.joystick.minInterval)
  addLog('摇杆激活 (触摸)')
}

// 鼠标移动
function handleMouseMove(event) {
  if (isDragging.value) {
    updatePosition(event.clientX, event.clientY)
  }
}

// 触摸移动
function handleTouchMove(event) {
  if (isDragging.value) {
    event.preventDefault()
    const touch = event.touches[0]
    updatePosition(touch.clientX, touch.clientY)
  }
}

// 鼠标释放
function handleMouseUp() {
  if (isDragging.value) {
    resetPosition()
    addLog('摇杆释放')
  }
}

// 触摸结束
function handleTouchEnd() {
  if (isDragging.value) {
    resetPosition()
    addLog('摇杆释放 (触摸)')
  }
}

// 更新位置
function updatePosition(clientX, clientY) {
  const pos = calculatePosition(clientX, clientY)
  position.value = { x: pos.x, y: pos.y }
  
  // 计算原始方向和力度（用于视觉位置）
  const rawDirection = {
    x: pos.x / (props.size / 2),
    y: pos.y / (props.size / 2),
    strength: pos.distance
  }
  
  // 应用速度档位到输出值（不影响视觉位置）
  const speedMultiplier = speedMappings[props.speedMode]
  const newDirection = {
    x: rawDirection.x * speedMultiplier,
    y: rawDirection.y * speedMultiplier,
    strength: rawDirection.strength * speedMultiplier
  }
  
  direction.value = newDirection
  
  // 重新启用自动停止
  isAutoStopEnabled.value = true
}

// 心跳检测函数
function checkHeartbeat() {
  const now = Date.now()
  // 只有当用户不在拖拽时才进行超时检测，且自动停止启用时才检测
  if (!isDragging.value && isAutoStopEnabled.value && now - lastCommandTime.value > config.safety.autoStopDelay) {
    // 超过500ms无指令，自动停止
    // 只发送stop事件，不调用resetPosition()，避免打断拖拽
    direction.value = { x: 0, y: 0, strength: 0 }
    emit('stop')
    addLog('自动停止（超时）')
    // 禁用自动停止，直到有新指令
    isAutoStopEnabled.value = false
  }
}

// 重置位置
function resetPosition() {
  isActive.value = false
  isDragging.value = false
  
  // 停止持续发送定时器
  if (sendInterval.value) {
    clearInterval(sendInterval.value)
    sendInterval.value = null
  }
  
  // 清理现有的定时器
  if (resetInterval.value) {
    clearInterval(resetInterval.value)
    resetInterval.value = null
  }
  
  // 平滑回正
  resetInterval.value = setInterval(() => {
    position.value = {
      x: position.value.x * 0.8,
      y: position.value.y * 0.8
    }
    
    if (Math.abs(position.value.x) < 1 && Math.abs(position.value.y) < 1) {
      position.value = { x: 0, y: 0 }
      clearInterval(resetInterval.value)
      resetInterval.value = null
    }
  }, 16)
  
  direction.value = { x: 0, y: 0, strength: 0 }
  emit('stop')
  // 更新lastCommandTime，避免心跳检测立即触发
  lastCommandTime.value = Date.now()
  addLog('摇杆回正')
}

// 方向键按下
function handleDirectionKeyDown(dir) {
  currentDirection.value = dir
  
  // 立即触发一次
  handleDirectionKey(dir)
  
  // 立即开始长按连续触发，83ms间隔
  directionKeyInterval.value = setInterval(() => {
    if (currentDirection.value === dir) {
      handleDirectionKey(dir)
    }
  }, config.key.minInterval)
  
  addLog(`方向键 ${dir} 按下`)
}

// 方向键释放
function handleDirectionKeyUp() {
  if (directionKeyInterval.value) {
    // 清除定时器（可能是setTimeout或setInterval）
    clearTimeout(directionKeyInterval.value)
    clearInterval(directionKeyInterval.value)
    directionKeyInterval.value = null
  }
  
  if (currentDirection.value) {
    addLog(`方向键 ${currentDirection.value} 释放`)
    currentDirection.value = ''
  }
  
  // 直接设置位置为0，无动画
  position.value = { x: 0, y: 0 }
  // 如果当前有摇杆拖拽，不要清空 isActive 状态
  if (!isDragging.value) {
    isActive.value = false
  }
  direction.value = { x: 0, y: 0, strength: 0 }
  
  // 更新摇杆样式
  updateKnobStyle()
  
  emit('stop')
  // 更新lastCommandTime，避免心跳检测立即触发
  lastCommandTime.value = Date.now()
  addLog('方向键回正')
}

// 方向键处理
function handleDirectionKey(dir) {
  // 只有当当前方向与传入方向一致时才执行
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
  
  // 最大偏移 = size * 0.3
  const maxOffset = props.size * 0.3
  // 输出速度 = config.key.fixedSpeed × speedMultiplier
  const speedMultiplier = speedMappings[props.speedMode]
  const outputSpeed = config.key.fixedSpeed * speedMultiplier
  // 视觉偏移 = (输出速度 / 1.0) × 最大偏移 × 0.8
  const offset = (outputSpeed / 1.0) * maxOffset * 0.8
  
  position.value = {
    x: x * offset,
    y: y * offset
  }
  
  isActive.value = true
  
  // 应用速度档位（使用已计算的outputSpeed）
  const fixedSpeed = outputSpeed
  
  const newDirection = {
    x: x * fixedSpeed,
    y: y * fixedSpeed,
    strength: fixedSpeed
  }
  
  // 移除相同方向检查，允许重复发送，只通过频率控制节流
  
  direction.value = newDirection
  
  // 重新启用自动停止
  isAutoStopEnabled.value = true
  
  // 添加source标识
  const directionWithSource = {
    ...newDirection,
    source: 'key'
  }
  
  emit('move', directionWithSource)
  lastDirection.value = { ...newDirection }
  lastCommandTime.value = Date.now()
  
  addLog(`方向键 ${dir} 触发`)
}

// 添加日志
function addLog(message) {
  const timestamp = new Date().toLocaleTimeString()
  logMessages.value.push(`[${timestamp}] ${message}`)
  
  // 限制日志数量
  if (logMessages.value.length > 10) {
    logMessages.value.shift()
  }
}

onMounted(() => {
  document.addEventListener('mousemove', handleMouseMove)
  document.addEventListener('mouseup', handleMouseUp)
  document.addEventListener('touchmove', handleTouchMove, { passive: false })
  document.addEventListener('touchend', handleTouchEnd)
  
  // 更新lastCommandTime，避免初始化后立即触发心跳检测
  lastCommandTime.value = Date.now()
  
  // 启动心跳检测
  heartbeatInterval.value = setInterval(checkHeartbeat, config.safety.heartbeatInterval)
  
  // 初始化样式
  updateKnobStyle()
  
  addLog('摇杆初始化完成')
})

onUnmounted(() => {
  document.removeEventListener('mousemove', handleMouseMove)
  document.removeEventListener('mouseup', handleMouseUp)
  document.removeEventListener('touchmove', handleTouchMove)
  document.removeEventListener('touchend', handleTouchEnd)
  
  if (directionKeyInterval.value) {
    clearInterval(directionKeyInterval.value)
  }
  
  if (resetInterval.value) {
    clearInterval(resetInterval.value)
  }
  
  if (sendInterval.value) {
    clearInterval(sendInterval.value)
  }
  
  // 清理心跳检测定时器
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

/* 十字键布局 */
.joystick-pad {
  position: relative;
  width: calc(v-bind(size) * 2px);
  height: calc(v-bind(size) * 2px);
  display: flex;
  align-items: center;
  justify-content: center;
}

/* 方向按钮 */
.direction-btn {
  position: absolute;
  width: calc(v-bind(size) * 0.4px);
  height: calc(v-bind(size) * 0.4px);
  border-radius: 50%;
  background: rgba(255, 255, 255, 0.1);
  backdrop-filter: blur(10px);
  border: 1px solid rgba(255, 255, 255, 0.2);
  display: flex;
  align-items: center;
  justify-content: center;
  cursor: pointer;
  transition: all 0.2s ease;
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.3);
}

.direction-btn:hover {
  background: rgba(255, 255, 255, 0.15);
  border-color: v-bind(color);
  transform: translateY(-2px);
  box-shadow: 0 4px 12px rgba(64, 158, 255, 0.3);
}

.direction-btn:active {
  background: rgba(255, 255, 255, 0.2);
  transform: scale(0.95) translateY(0);
  box-shadow: 0 1px 4px rgba(64, 158, 255, 0.2);
}

/* 方向按钮位置 */
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

/* 摇杆 */
.joystick-wrapper {
  position: relative;
  width: v-bind(size + 'px');
  height: v-bind(size + 'px');
  cursor: grab;
  touch-action: none;
}

.joystick-wrapper:active {
  cursor: grabbing;
}

/* 摇杆底座 */
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

/* 摇杆头 */
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

/* 状态显示 */
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

/* 控制台日志 */
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

/* 响应式设计 */
@media screen and (max-width: 768px) {
  .joystick-pad {
    width: calc(v-bind(size) * 1.6px);
    height: calc(v-bind(size) * 1.6px);
  }
  
  .direction-btn {
    width: calc(v-bind(size) * 0.32px);
    height: calc(v-bind(size) * 0.32px);
  }
  
  .joystick-wrapper {
    width: calc(v-bind(size) * 0.8px);
    height: calc(v-bind(size) * 0.8px);
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
  
  .joystick-wrapper {
    width: calc(v-bind(size) * 0.7px);
    height: calc(v-bind(size) * 0.7px);
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