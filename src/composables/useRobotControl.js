import { ref, onUnmounted } from 'vue'
import { useSocket } from './useSocket'
import { useDeviceStore } from '@/stores/device'
import { createSportControlMessage, createWebSocketMessage } from '@/utils/protocol'

/**
 * @typedef {Object} Direction
 * @property {number} x X轴方向值（-1到1）
 * @property {number} y Y轴方向值（-1到1）
 * @property {number} strength 力度值（0到1）
 * @property {string} [source='joystick'] 数据来源（'joystick'|'key'）
 */

/**
 * @typedef {Object} JoystickCallbacks
 * @property {Function} [move] 移动回调函数
 * @property {Function} [stop] 停止回调函数
 */

/**
 * 打印运动控制消息体（用于调试）
 * @param {string} title - 标题
 * @param {Object} wsMessage - WebSocket消息对象
 * @param {Object} extraInfo - 额外信息（摇杆数据等）
 */
function logSportMessage(title, wsMessage, extraInfo = {}) {
  console.log(`\n${'='.repeat(60)}`)
  console.log(`🎮 ${title}`)
  console.log(`${'='.repeat(60)}`)
  
  if (extraInfo.side) {
    console.log(`🕹️ 触发摇杆: ${extraInfo.side === 'left' ? '左摇杆' : '右摇杆'}`)
  }
  if (extraInfo.leftState) {
    console.log(`📍 左摇杆状态: x=${extraInfo.leftState.x.toFixed(3)}, y=${extraInfo.leftState.y.toFixed(3)}, strength=${extraInfo.leftState.strength.toFixed(3)}`)
  }
  if (extraInfo.rightState) {
    console.log(`📍 右摇杆状态: x=${extraInfo.rightState.x.toFixed(3)}, y=${extraInfo.rightState.y.toFixed(3)}, strength=${extraInfo.rightState.strength.toFixed(3)}`)
  }
  
  console.log('\n📋 完整消息体:')
  console.log(JSON.stringify(wsMessage, null, 2))
  console.log('\n📊 消息字段解析:')
  console.log(`   • deviceId: ${wsMessage.deviceId}`)
  console.log(`   • parameters: ${JSON.stringify(wsMessage.parameters)}`)
  console.log(`   • command (已序列化):`)
  
  const command = JSON.parse(wsMessage.command)
  console.log(`      - session_id: ${command.session_id}`)
  console.log(`      - protocol_version: ${command.protocol_version}`)
  console.log(`      - timestamp: ${command.timestamp} (${new Date(command.timestamp).toLocaleString()})`)
  console.log(`      - msg_type: ${command.msg_type}`)
  console.log(`      - msg_cmd: ${command.msg_cmd} (运动控制)`)
  console.log(`      - data:`)
  console.log(`         • cmd_velx: ${command.data.cmd_velx} (前进/后退速度)`)
  console.log(`         • cmd_vely: ${command.data.cmd_vely} (左移/右移速度)`)
  console.log(`         • cmd_yaw: ${command.data.cmd_yaw} (旋转速度)`)
  console.log(`${'='.repeat(60)}\n`)
}

/**
 * 机器人控制组合式函数
 * 提供摇杆控制机器人的核心功能，包括移动指令发送、停止指令发送和连接状态管理
 * @returns {Object} 包含控制方法和状态的对象
 */
export function useRobotControl() {
  const { connected, sendCommand } = useSocket()
  const deviceStore = useDeviceStore()

  const isConnected = ref(false)
  const leftJoystick = ref({ move: null, stop: null })
  const rightJoystick = ref({ move: null, stop: null })

  const leftState = ref({ x: 0, y: 0, strength: 0 })
  const rightState = ref({ x: 0, y: 0, strength: 0 })

  const lastStopSide = ref('')
  const lastStopTime = ref(0)

  function clamp(val, min, max) {
    return Math.max(min, Math.min(max, val))
  }

  /**
   * 检查是否可以发送命令
   * 只在控制台输出警告，不弹窗打扰用户
   * @returns {boolean} 是否可以发送
   */
  function canSendCommand() {
    // 检查设备是否已连接
    if (!deviceStore.currentDevice) {
      console.warn('[RobotControl] 未选择设备，无法发送指令')
      return false
    }

    // 检查 WebSocket 是否已连接
    if (!connected.value) {
      console.warn('[RobotControl] WebSocket未连接，无法发送指令')
      return false
    }

    return true
  }

  /**
   * 发送机器人移动指令
   * 按照 doc.md 中的行走控制格式发送消息
   *
   * 转换规则:
   *   左摇杆 y轴 (上推=负值 / 下推=正值) → cmd_velx (前进=正值 / 后退=负值)
   *     → cmd_velx = -left.y × 100   范围 [-100, 100]
   *   左摇杆 x轴 (右推=正值 / 左推=负值) → cmd_vely (左移=正值 / 右移=负值)
   *     → cmd_vely = -left.x × 100   范围 [-100, 100]
   *   右摇杆 x轴 (右推=正值 / 左推=负值) → cmd_yaw (左转=正值 / 右转=负值)
   *     → cmd_yaw = -right.x × 100   范围 [-100, 100]
   *
   * @param {Direction} direction 方向数据对象
   * @param {'left'|'right'} side 摇杆侧边
   * @returns {void}
   */
  function sendMove(direction, side = 'left') {
    if (!canSendCommand()) return

    if (side === 'left') {
      leftState.value = { ...direction }
    } else {
      rightState.value = { ...direction }
    }

    const left = leftState.value
    const right = rightState.value

    const cmdVelX = clamp(-left.y * 100, -100, 100)
    const cmdVelY = clamp(-left.x * 100, -100, 100)
    const cmdYaw = clamp(-right.x * 100, -100, 100)

    // 使用 protocol.js 创建消息
    const message = createSportControlMessage(cmdVelX, cmdVelY, cmdYaw)
    const wsMessage = createWebSocketMessage(message, deviceStore.currentDevice)

    logSportMessage('运动控制命令 [移动]', wsMessage, {
      side,
      leftState: left,
      rightState: right
    })

    sendCommand(deviceStore.currentDevice, 'robot:move', message)
  }

  /**
   * 发送机器人停止指令
   * 当某个摇杆释放时，仅将该摇杆的速度分量置零，
   * 若另一个摇杆仍在操作则保留其速度值，组合后发送
   * @param {string} [side='all'] 停止侧边（'left'|'right'|'all'）
   * @returns {void}
   */
  function sendStop(side = 'all') {
    if (!canSendCommand()) return

    const now = Date.now()
    if (side === lastStopSide.value && now - lastStopTime.value < 200) {
      return
    }
    lastStopSide.value = side
    lastStopTime.value = now

    if (side === 'left' || side === 'all') {
      leftState.value = { x: 0, y: 0, strength: 0 }
    }
    if (side === 'right' || side === 'all') {
      rightState.value = { x: 0, y: 0, strength: 0 }
    }

    const left = leftState.value
    const right = rightState.value

    const cmdVelX = clamp(-left.y * 100, -100, 100)
    const cmdVelY = clamp(-left.x * 100, -100, 100)
    const cmdYaw = clamp(-right.x * 100, -100, 100)

    // 使用 protocol.js 创建消息
    const message = createSportControlMessage(cmdVelX, cmdVelY, cmdYaw)
    const wsMessage = createWebSocketMessage(message, deviceStore.currentDevice)

    logSportMessage(`运动控制命令 [停止 - ${side === 'all' ? '全部' : (side === 'left' ? '左摇杆' : '右摇杆')}]`, wsMessage, {
      leftState: left,
      rightState: right
    })

    sendCommand(deviceStore.currentDevice, 'robot:stop', message)
  }

  /**
   * 建立机器人控制连接
   * @returns {void}
   */
  function connect() {
    isConnected.value = connected.value
  }

  /**
   * 断开机器人控制连接
   * @returns {void}
   */
  function disconnect() {
    isConnected.value = false
  }

  onUnmounted(() => {
    disconnect()
  })

  return {
    isConnected,
    leftJoystick,
    rightJoystick,
    sendMove,
    sendStop,
    connect,
    disconnect
  }
}
