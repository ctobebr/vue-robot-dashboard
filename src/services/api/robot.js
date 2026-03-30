import request from '../request'

const robotAPI = {
  // 拍照
  capture: () =>
    request.post('/robot/capture', { timestamp: Date.now() }),

  // 开始录像
  startRecord: () =>
    request.post('/robot/record/start', { timestamp: Date.now() }),

  // 停止录像
  stopRecord: (sessionId) =>
    request.post('/robot/record/stop', { sessionId, timestamp: Date.now() }),

  // 机器人移动控制
  move: (data) =>
    request.post('/robot/move', data),

  // 机器人停止
  stop: (side) =>
    request.post('/robot/stop', { side }),
}

export default robotAPI