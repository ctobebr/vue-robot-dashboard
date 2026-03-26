import { io } from 'socket.io-client'
import { ref, onUnmounted, provide, inject } from 'vue'

const SocketKey = Symbol('socket')

/**
 * Socket 内部初始化函数
 * 用于创建和管理 Socket.io 连接实例
 * 
 * @returns {Object} 返回包含 socket 实例的对象
 * @property {Ref} socket - Socket.io 连接实例的响应式引用
 */
function useSocketInternal() {
  // 声明响应式的 socket 实例引用
  const socket = ref(null)

  /**
   * 初始化 Socket.io 连接
   * 仅在 socket 实例不存在时创建新连接
   * 
   * @returns {void}
   */
  function initSocket() {
    // 如果 socket 实例已存在，直接返回
    if (socket.value) return
    
    // 创建新的 Socket.io 连接
    // 连接地址格式：http://{hostname}:8000/{deviceSN}
    // 配置自动重连机制
    const newSocket = io(`http://${window.location.hostname}:8000/${import.meta.env.VITE_DEVICE_SN}`, {
      reconnection: true,              // 启用自动重连
      reconnectionAttempts: Infinity,  // 无限次重连尝试
      reconnectionDelay: 1000,         // 重连延迟 1000ms
      reconnectionDelayMax: 5000,      // 最大重连延迟 5000ms
    })

    // 监听连接成功事件
    newSocket.on('connect', () => {
    })

    // 监听连接错误事件
    newSocket.on('connect_error', () => {
    })

    // 保存 socket 实例
    socket.value = newSocket
  }

  // 组件卸载时关闭 socket 连接
  onUnmounted(() => {
    if (socket.value) {
      socket.value.close()
    }
  })

  // 初始化 socket 连接
  initSocket()

  // 返回 socket 实例
  return {
    socket
  }
}

/**
 * 提供 Socket 实例给 Vue 应用
 * 使用 Vue 的 provide 机制将 socket 实例注入到应用中
 * 
 * @returns {Object} 返回 socket 实例对象
 * @property {Ref} socket - Socket.io 连接实例的响应式引用
 */
export function provideSocket() {
  // 获取 socket 实例
  const socketInstance = useSocketInternal()
  // 使用 provide 机制注入 socket 实例
  provide(SocketKey, socketInstance)
  // 返回 socket 实例
  return socketInstance
}

/**
 * 获取 Socket 实例的组合式函数
 * 使用 Vue 的 inject 机制从应用中获取 socket 实例
 * 
 * @returns {Object} 返回 socket 实例对象
 * @property {Ref} socket - Socket.io 连接实例的响应式引用
 * @throws {Error} 如果在没有调用 provideSocket() 的情况下使用，会抛出错误
 */
export function useSocket() {
  // 从应用中注入 socket 实例
  const socketInstance = inject(SocketKey)
  // 检查 socket 实例是否存在
  if (!socketInstance) {
    throw new Error('useSocket() is called without provideSocket()')
  }
  // 返回 socket 实例
  return socketInstance
}
