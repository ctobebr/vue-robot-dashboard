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

  /**
   * 发送机器人移动指令
   * 按照 doc.md 中的行走控制格式发送消息
   * @param {Direction} direction 方向数据对象
   * @returns {void}
   */
  function sendMove(direction) {
    if (!connected.value) {
      console.warn('[RobotControl] WebSocket未连接，无法发送移动指令')
      return
    }

    if (!deviceStore.currentDevice) {
      console.warn('[RobotControl] 未选择设备，无法发送移动指令')
      return
    }

    // 将摇杆的 x, y 转换为机器人速度控制
    // 摇杆坐标系：x 左右（-1到1，正值=右推），y 上下（-1到1，正值=前推）
    // 机器人坐标系：
    //   - cmd_velx：前后方向线速度（正值=前进，负值=后退，单位 m/s）
    //   - cmd_vely：左右方向线速度（正值=向左，负值=向右，单位 m/s）
    //   - cmd_yaw：绕Z轴角速度（正值=逆时针，负值=顺时针，单位 rad/s）
    const maxSpeed = 1.0
    const maxYawSpeed = 1.0

    const linearSpeed = Math.abs(direction.y) * maxSpeed
    const lateralSpeed = Math.abs(direction.x) * maxSpeed
    const yawSpeed = Math.abs(direction.x) * maxYawSpeed

    const cmdVelX = direction.y * linearSpeed
    const cmdVelY = -direction.x * lateralSpeed
    const cmdYaw = -direction.x * yawSpeed

    // 按照 doc.md 中的行走控制格式构建消息
    const message = {
      session_id: sessionId++,
      protocol_version: "v1.0.0",
      timestamp: getTimestamp(),
      msg_type: 0,  // 0为消息
      msg_cmd: 3006, // 行走控制命令
      data: {
        cmd_velx: parseFloat(cmdVelX.toFixed(3)),
        cmd_vely: parseFloat(cmdVelY.toFixed(3)),
        cmd_yaw: parseFloat(cmdYaw.toFixed(3))
      }
    }

    // 在控制台展示发送的命令（用于测试）
    console.log('===== [RobotControl] 发送行走控制命令 =====')
    console.log('设备ID:', deviceStore.currentDevice)
    console.log('原始摇杆数据:', {
      x: direction.x,
      y: direction.y,
      strength: direction.strength
    })
    console.log('转换后的速度:', {
      cmd_velx: message.data.cmd_velx,
      cmd_vely: message.data.cmd_vely,
      cmd_yaw: message.data.cmd_yaw
    })
    console.log('完整消息体:', JSON.stringify(message, null, 2))
    console.log('目标地址:', '/app/device/command')
    console.log('=========================================')

    // 使用STOMP发送命令
    sendCommand(deviceStore.currentDevice, 'robot:move', message)
  }

  /**
   * 发送机器人停止指令
   * @param {string} [side='all'] 停止侧边（'left'|'right'|'all'）
   * @returns {void}
   */
  function sendStop(side) {
    if (!connected.value) {
      console.warn('[RobotControl] WebSocket未连接，无法发送停止指令')
      return
    }

    if (!deviceStore.currentDevice) {
      console.warn('[RobotControl] 未选择设备，无法发送停止指令')
      return
    }

    // 停止命令也使用相同的格式，但速度为0
    const message = {
      session_id: sessionId++,
      protocol_version: "v1.0.0",
      timestamp: getTimestamp(),
      msg_type: 0,
      msg_cmd: 3006,
      data: {
        cmd_velx: 0,
        cmd_vely: 0,
        cmd_yaw: 0
      }
    }

    console.log('===== [RobotControl] 发送停止命令 =====')
    console.log('设备ID:', deviceStore.currentDevice)
    console.log('完整消息体:', JSON.stringify(message, null, 2))
    console.log('=========================================')

    // 使用STOMP发送命令
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
