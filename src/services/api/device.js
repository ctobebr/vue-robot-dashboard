import request from '../request'

// 设备相关API
const deviceAPI = {
  // 获取数据详情
  getDataDetails: () => request.get('/dataDetails'),
  
  // 开始录制
  startRecording: (deviceSN, dataName) => 
    request.post(`/devices/${deviceSN}/record_start`, { name: dataName }),
  
  // 停止录制
  stopRecording: (deviceSN) => 
    request.post(`/devices/${deviceSN}/record_stop`),
  
  // 重置映射
  resetMapping: (deviceSN) => 
    request.post(`/devices/${deviceSN}/mapping_reset`),
  
  // 设置网络
  setNetworks: (deviceSN, networks) => 
    request.post(`/devices/${deviceSN}/set_networks`, { networks }),
}

export default deviceAPI
