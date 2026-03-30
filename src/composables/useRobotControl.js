import { ref, onUnmounted } from 'vue'
import { useSocket } from './useSocket'
import { robotAPI } from '@/services/api'

export function useRobotControl() {
  const { socket } = useSocket()

  const isConnected = ref(false)
  const leftJoystick = ref({ move: null, stop: null })
  const rightJoystick = ref({ move: null, stop: null })

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

  function sendStop(side) {
    if (!socket.value) return

    const message = {
      type: 'robot:stop',
      data: { side: side || 'all' },
      timestamp: Date.now()
    }

    socket.value.emit('robot:stop', message)
  }

  function connect() {
    if (socket.value) {
      isConnected.value = true
    }
  }

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