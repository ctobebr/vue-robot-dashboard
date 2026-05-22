// ### WebSocket连接管理 - STOMP协议版本

import { Client } from '@stomp/stompjs'
import { ref, onUnmounted, provide, inject } from 'vue'
import SockJS from 'sockjs-client'

const SocketKey = Symbol('socket')

const SOCKET_URL = import.meta.env.VITE_SOCKET_URL || 'http://172.30.14.57:8080'

function parseSocketUrl(url) {
  try {
    const urlObj = new URL(url)
    return { host: urlObj.hostname, port: urlObj.port || '8080' }
  } catch (e) {
    return { host: '172.30.14.57', port: '8080' }
  }
}

const { host: WS_SERVER_HOST, port: WS_SERVER_PORT } = parseSocketUrl(SOCKET_URL)

function useSocketInternal() {
  const client = ref(null)
  const connected = ref(false)
  const connectionError = ref(null)
  const subscriptions = ref(new Map())
  const currentDeviceId = ref(null)
  const heartbeatInterval = ref(null)

  function log(message, data = null) {
    if (data) {
      console.log(`[WebSocket] ${message}`, data)
    } else {
      console.log(`[WebSocket] ${message}`)
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
    const sockjsBaseUrl = `http://${WS_SERVER_HOST}:${WS_SERVER_PORT}/ws/robot`

    const clientConfig = {
      connectHeaders: { Authorization: `Bearer ${token || ''}` },
      reconnectDelay: 30000,
      heartbeatIncoming: 0,
      heartbeatOutgoing: 0,
    }

    clientConfig.webSocketFactory = createSockJSFactory(sockjsBaseUrl)

    const stompClient = new Client(clientConfig)

    stompClient.onConnect = () => {
      log('连接已建立', { deviceId })
      connected.value = true
      connectionError.value = null
      
      // 监听后端发送的消息（用于调试，在控制台输出）
      if (deviceId) {
        const deviceQueue = `/queue/device/${deviceId}`
        stompClient.subscribe(deviceQueue, (message) => {
          console.log('[WebSocket] 收到后端消息:', { destination: deviceQueue, body: message.body })
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
    
    // 如果 message 已经是完整的协议格式，直接发送
    // 否则包装成旧格式（兼容）
    const finalMessage = message.msg_cmd ? message : {
      deviceId,
      command: commandType,
      parameters: message
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
    disconnect
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
