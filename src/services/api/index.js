import deviceAPI from './device'
import robotAPI from './robot'

// 统一导出所有API模块
export {
  deviceAPI,
  robotAPI
}

export default {
  device: deviceAPI,
  robot: robotAPI
}
