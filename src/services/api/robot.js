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


}

export default robotAPI