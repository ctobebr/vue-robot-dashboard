// ### WebSocket连接管理 - STOMP协议版本

import { Client } from '@stomp/stompjs'
import { ref, onUnmounted, provide, inject } from 'vue'
import SockJS from 'sockjs-client'
import { useDeviceStore } from '@/stores/device'

const SocketKey = Symbol('socket')

// 从环境变量读取WebSocket服务器地址
const SOCKET_URL = import.meta.env.VITE_SOCKET_URL || 'http://172.30.1.132:8080'
const isDev = import.meta.env.DEV

function parseSocketUrl(url) {
  try {
    const urlObj = new URL(url)
    return { host: urlObj.hostname, port: urlObj.port || '8080' }
  } catch (e) {
    return { host: '172.30.1.132', port: '8080' }
  }
}

const { host: WS_SERVER_HOST, port: WS_SERVER_PORT } = parseSocketUrl(SOCKET_URL)

// 开发环境使用相对路径走 Vite 代理，生产环境使用完整 URL
const WS_BASE_URL = isDev ? '' : `http://${WS_SERVER_HOST}:${WS_SERVER_PORT}`

function useSocketInternal() {
  const client = ref(null)
  const connected = ref(false)
  const connectionError = ref(null)
  const subscriptions = ref(new Map())
  const currentDeviceId = ref(null)
  const heartbeatInterval = ref(null)

  // 日志节流控制
  let lastLogTime = 0
  const LOG_INTERVAL = 10000 // 10秒

  function shouldLog() {
    const now = Date.now()
    if (now - lastLogTime >= LOG_INTERVAL) {
      lastLogTime = now
      return true
    }
    return false
  }

  function log(message, data = null) {
    if (data) {
      console.log(`[WebSocket] ${message}`, data)
    } else {
      console.log(`[WebSocket] ${message}`)
    }
  }

  // 设备状态消息回调函数（由外部设置）
  let deviceStatusCallback = null
  
  /**
   * 设置设备状态消息处理回调
   * @param {Function} callback - 回调函数
   */
  function setDeviceStatusCallback(callback) {
    deviceStatusCallback = callback
  }
  
  /**
   * 处理设备状态消息
   * @param {Object} message - 解析后的消息对象
   */
  function handleDeviceStatusMessage(message) {
    try {
      // 解析嵌套的数据结构
      // 消息格式: { deviceId, message: { rawData: { data: { cpu_usage, memory_usage, disk_usage } } } }
      let deviceData = null
      
      if (message.message?.rawData?.data) {
        // 新格式: 数据在 message.rawData.data 中
        deviceData = message.message.rawData.data
      } else if (message.data) {
        // 旧格式: 数据直接在 data 中
        deviceData = message.data
      } else {
        // 尝试直接使用 message
        deviceData = message
      }
      
      if (!deviceData || typeof deviceData !== 'object') {
        if (shouldLog()) {
          console.log('[WebSocket] 未找到有效的设备状态数据')
        }
        return
      }

      if (shouldLog()) {
        console.log('[WebSocket] 解析到设备状态数据:', deviceData)
      }
      
      // 如果有外部回调，调用它（让 Vue 组件处理 store 更新）
      if (deviceStatusCallback) {
        deviceStatusCallback(deviceData)
      }
    } catch (error) {
      console.error('[WebSocket] 处理设备状态消息失败:', error)
    }
  }

  function createSockJSFactory(baseUrl) {
    return () => new SockJS(baseUrl)
  }

  async function initSocket(deviceId = null) {
    if (client.value && connected.value && currentDeviceId.value === deviceId) {
      return
    }

    if (client.value) {
      disconnect()
    }

    currentDeviceId.value = deviceId
    const token = localStorage.getItem('token')
    // 开发环境使用相对路径走 Vite 代理，生产环境使用完整 URL
    const sockjsBaseUrl = isDev ? '/ws/robot' : `http://${WS_SERVER_HOST}:${WS_SERVER_PORT}/ws/robot`

    const clientConfig = {
      connectHeaders: { Authorization: `Bearer ${token || ''}` },
      reconnectDelay: 30000,
      heartbeatIncoming: 0,
      heartbeatOutgoing: 0,
    }

    clientConfig.webSocketFactory = createSockJSFactory(sockjsBaseUrl)

    const stompClient = new Client(clientConfig)

    // 将 stompClient 暴露到全局，供 device store 使用
    window.__stompClient__ = stompClient

    stompClient.onConnect = () => {
      log('连接已建立', { deviceId })
      connected.value = true
      connectionError.value = null
      
      // 监听后端发送的消息（用于调试，在控制台输出）
      if (deviceId) {
        const deviceQueue = `/queue/device/${deviceId}`
        stompClient.subscribe(deviceQueue, (message) => {
          try {
            const parsedBody = JSON.parse(message.body)
            // 递归解析嵌套的 JSON 字符串（如 rawData 字段）
            const deepParse = (obj) => {
              if (typeof obj === 'string') {
                try {
                  const parsed = JSON.parse(obj)
                  return deepParse(parsed)
                } catch {
                  return obj
                }
              }
              if (Array.isArray(obj)) {
                return obj.map(deepParse)
              }
              if (obj && typeof obj === 'object') {
                const result = {}
                for (const [key, value] of Object.entries(obj)) {
                  result[key] = deepParse(value)
                }
                return result
              }
              return obj
            }
            const fullyParsed = deepParse(parsedBody)
            if (shouldLog()) {
              // console.log('[WebSocket] 收到后端消息:')
              // console.log('  目标队列:', deviceQueue)
              // console.log('  消息内容:', JSON.stringify(fullyParsed, null, 2))
            }

            // 处理设备状态数据，更新到全局 store
            handleDeviceStatusMessage(fullyParsed)
          } catch (e) {
            if (shouldLog()) {
              // console.log('[WebSocket] 收到后端消息（非JSON）:')
              // console.log('  目标队列:', deviceQueue)
              // console.log('  原始内容:', message.body)
            }
          }
        })
      }
      
      // 启动心跳检测
      startHeartbeat()
    }

    stompClient.onStompError = (frame) => {
      log('连接错误', { message: frame.headers['message'] })
      connected.value = false
      connectionError.value = frame.headers['message']
    }

    stompClient.onWebSocketClose = () => {
      log('连接已断开')
      connected.value = false
      stopHeartbeat()
    }

    stompClient.activate()
    client.value = stompClient
  }

  function subscribe(deviceId, topic, callback) {
    if (!client.value || !connected.value) return null

    const subKey = `${deviceId}-${topic}`
    
    // 检查是否已经订阅过，防止重复订阅
    if (subscriptions.value.has(subKey)) {
      log('设备已订阅，跳过重复订阅', { deviceId, topic })
      return subscriptions.value.get(subKey)
    }

    const destination = `/topic/device/${deviceId}/${topic}`
    const token = localStorage.getItem('token')

    // 发送订阅请求
    client.value.publish({
      destination: '/app/device/subscribe',
      body: JSON.stringify({ deviceId }),
      headers: { Authorization: `Bearer ${token || ''}` }
    })

    const subscription = client.value.subscribe(destination, (message) => {
      try {
        callback(JSON.parse(message.body))
      } catch (e) {
        callback(message.body)
      }
    })

    subscriptions.value.set(subKey, subscription)
    log('设备已订阅', { deviceId, topic })
    return subscription
  }

  function unsubscribe(deviceId, topic) {
    const subKey = `${deviceId}-${topic}`
    if (subscriptions.value.has(subKey)) {
      subscriptions.value.get(subKey).unsubscribe()
      subscriptions.value.delete(subKey)
      log('设备已取消订阅', { deviceId, topic })
    }
  }

  function unsubscribeAll() {
    subscriptions.value.forEach((sub) => {
      sub.unsubscribe()
    })
    subscriptions.value.clear()
  }

  function sendCommand(deviceId, commandType, message) {
    if (!client.value || !connected.value) {
      console.warn('[WebSocket] 未连接，无法发送命令')
      return false
    }

    const token = localStorage.getItem('token')

    const finalMessage = {
      command: JSON.stringify(message),
      deviceId: deviceId,
      parameters: {}
    }

    client.value.publish({
      destination: '/app/device/command',
      body: JSON.stringify(finalMessage),
      headers: { Authorization: `Bearer ${token || ''}` }
    })
    return true
  }

  function startHeartbeat() {
    // 每30秒检测一次连接状态
    heartbeatInterval.value = setInterval(() => {
      if (client.value && client.value.connected) {
        log('心跳检测：连接正常')
      } else {
        log('心跳检测：连接已断开')
        connected.value = false
        stopHeartbeat()
      }
    }, 30000)
  }
  
  function stopHeartbeat() {
    if (heartbeatInterval.value) {
      clearInterval(heartbeatInterval.value)
      heartbeatInterval.value = null
    }
  }

  function disconnect() {
    if (client.value) {
      stopHeartbeat()
      unsubscribeAll()
      client.value.deactivate()
      client.value = null
      connected.value = false
      currentDeviceId.value = null
      log('连接已断开')
    }
  }

  onUnmounted(() => disconnect())

  return {
    client,
    connected,
    connectionError,
    currentDeviceId,
    initSocket,
    subscribe,
    unsubscribe,
    unsubscribeAll,
    sendCommand,
    disconnect,
    setDeviceStatusCallback
  }
}

export function provideSocket() {
  const socketInstance = useSocketInternal()
  provide(SocketKey, socketInstance)
  return socketInstance
}

export function useSocket() {
  const socketInstance = inject(SocketKey)
  if (!socketInstance) {
    throw new Error('useSocket() is called without provideSocket()')
  }
  return socketInstance
}
