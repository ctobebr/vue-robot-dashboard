import { ref, onUnmounted } from 'vue'
import { useSocket } from './useSocket'
import { robotAPI } from '@/services/api'

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
  const { socket } = useSocket()

  const isConnected = ref(false)
  const leftJoystick = ref({ move: null, stop: null })
  const rightJoystick = ref({ move: null, stop: null })

  /**
   * 发送机器人移动指令
   * @param {Direction} direction 方向数据对象
   * @returns {void}
   * @throws {Error} 当socket未连接时不执行任何操作
   */
  function sendMove(direction) {
    if (!socket.value) return

    const message = {
      type: 'robot:move',
      data: {
        x: direction.x,
        y: direction.y,
        strength: direction.strength,
        source: direction.source || 'joystick'
      },
      timestamp: Date.now()
    }

    socket.value.emit('robot:move', message)
  }

  /**
   * 发送机器人停止指令
   * @param {string} [side='all'] 停止侧边（'left'|'right'|'all'）
   * @returns {void}
   * @throws {Error} 当socket未连接时不执行任何操作
   */
  function sendStop(side) {
    if (!socket.value) return

    const message = {
      type: 'robot:stop',
      data: { side: side || 'all' },
      timestamp: Date.now()
    }

    socket.value.emit('robot:stop', message)
  }

  /**
   * 建立机器人控制连接
   * @returns {void}
   */
  function connect() {
    if (socket.value) {
      isConnected.value = true
    }
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