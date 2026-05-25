import { ref, onUnmounted } from 'vue'
import { useSocket } from './useSocket'
import { useDeviceStore } from '@/stores/device'

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
 * @typedef {Object} RobotMessage
 * @property {string} type 消息类型
 * @property {Object} data 消息数据
 * @property {number} timestamp 时间戳
 */

// 会话ID，自增
let sessionId = 1

/**
 * 获取当前时间戳（毫秒）
 * @returns {number}
 */
function getTimestamp() {
  return Date.now()
}

/**
 * 机器人控制组合式函数
 * 提供摇杆控制机器人的核心功能，包括移动指令发送、停止指令发送和连接状态管理
 * @returns {Object} 包含控制方法和状态的对象
 * @property {ref<boolean>} isConnected 连接状态
 * @property {ref<JoystickCallbacks>} leftJoystick 左摇杆回调
 * @property {ref<JoystickCallbacks>} rightJoystick 右摇杆回调
 * @property {Function} sendMove 发送移动指令
 * @property {Function} sendStop 发送停止指令
 * @property {Function} connect 建立连接
 * @property {Function} disconnect 断开连接
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
   * 发送机器人移动指令
   * 按照 doc.md 中的行走控制格式发送消息
   *
   * 转换规则:
   *   左摇杆 y轴 (上推=负值 / 下推=正值) → cmd_velx (前进=正值 / 后退=负值)
   *     → cmd_velx = -left.y × 100   范围 [-100, 100]
   *   左摇杆 x轴 (右推=正值 / 左推=负值) → cmd_vely (左移=正值 / 右移=负值)
   *     → cmd_vely = -left.x × 100   范围 [-100, 100]
   *   右摇杆 x轴 (右推=正值/顺时针 / 左推=负值/逆时针) → cmd_yaw (顺时针=正值 / 逆时针=负值)
   *     → cmd_yaw = right.x × 100    范围 [-100, 100]
   *
   * @param {Direction} direction 方向数据对象
   * @param {'left'|'right'} side 摇杆侧边
   * @returns {void}
   */
  function sendMove(direction, side = 'left') {
    if (!connected.value) {
      console.warn('[RobotControl] WebSocket未连接，无法发送移动指令')
      return
    }

    if (!deviceStore.currentDevice) {
      console.warn('[RobotControl] 未选择设备，无法发送移动指令')
      return
    }

    if (side === 'left') {
      leftState.value = { ...direction }
    } else {
      rightState.value = { ...direction }
    }

    const left = leftState.value
    const right = rightState.value

    const cmdVelX = clamp(-left.y * 100, -100, 100)
    const cmdVelY = clamp(-left.x * 100, -100, 100)
    const cmdYaw = clamp(right.x * 100, -100, 100)

    const message = {
      session_id: sessionId++,
      protocol_version: "v1.0.0",
      timestamp: getTimestamp(),
      msg_type: 0,
      msg_cmd: 3006,
      data: {
        cmd_velx: parseFloat(cmdVelX.toFixed(1)),
        cmd_vely: parseFloat(cmdVelY.toFixed(1)),
        cmd_yaw: parseFloat(cmdYaw.toFixed(1))
      }
    }

    console.log('===== [RobotControl] 发送行走控制命令 =====')
    console.log('设备ID:', deviceStore.currentDevice)
    console.log('触发摇杆:', side === 'left' ? '左摇杆' : '右摇杆')
    console.log('左摇杆原始数据:', { x: left.x, y: left.y, strength: left.strength })
    console.log('右摇杆原始数据:', { x: right.x, y: right.y, strength: right.strength })
    console.log('转换后速度值:', {
      cmd_velx: message.data.cmd_velx,
      cmd_vely: message.data.cmd_vely,
      cmd_yaw: message.data.cmd_yaw
    })
    //console.log('完整消息体:', JSON.stringify(message, null, 2))
    console.log('发送包裹格式:', JSON.stringify({
      command: message,
      deviceId: deviceStore.currentDevice,
      parameters: {}
    }, null, 2))
    console.log('目标地址:', '/app/device/command')
    console.log('=========================================')

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
    if (!connected.value) {
      console.warn('[RobotControl] WebSocket未连接，无法发送停止指令')
      return
    }

    if (!deviceStore.currentDevice) {
      console.warn('[RobotControl] 未选择设备，无法发送停止指令')
      return
    }

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
    const cmdYaw = clamp(right.x * 100, -100, 100)

    const message = {
      session_id: sessionId++,
      protocol_version: "v1.0.0",
      timestamp: getTimestamp(),
      msg_type: 0,
      msg_cmd: 3006,
      data: {
        cmd_velx: parseFloat(cmdVelX.toFixed(1)),
        cmd_vely: parseFloat(cmdVelY.toFixed(1)),
        cmd_yaw: parseFloat(cmdYaw.toFixed(1))
      }
    }

    console.log('===== [RobotControl] 发送停止命令 =====')
    console.log('设备ID:', deviceStore.currentDevice)
    console.log('停止侧边:', side === 'all' ? '全部' : (side === 'left' ? '左摇杆' : '右摇杆'))
    console.log('当前左摇杆状态:', { x: left.x, y: left.y, strength: left.strength })
    console.log('当前右摇杆状态:', { x: right.x, y: right.y, strength: right.strength })
    console.log('转换后速度值:', {
      cmd_velx: message.data.cmd_velx,
      cmd_vely: message.data.cmd_vely,
      cmd_yaw: message.data.cmd_yaw
    })
    console.log('发送包裹格式:', JSON.stringify({
      command: JSON.stringify(message),
      deviceId: deviceStore.currentDevice,
      parameters: {}
    }, null, 2))
    console.log('=========================================')

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
