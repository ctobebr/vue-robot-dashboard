import request from '../request'

const deviceAPI = {
  // 获取数据详情列表
  getDataDetails: () => request.get('/dataDetails'),

  // 删除数据
  deleteData: (names) => request.delete('/deleteData', { data: { names } }),

  // 下载数据
  downloadData: (deviceSN, name) =>
    request.get(`/${deviceSN}/data/download/${name}`, {
      responseType: 'blob'
    }),

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
