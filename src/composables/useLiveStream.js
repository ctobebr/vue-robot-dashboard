import { ref, onUnmounted } from 'vue'

// 开发环境使用代理路径，生产环境使用实际地址
const isDev = import.meta.env.DEV
const STREAM_API_BASE = isDev ? '/live-api' : `http://${import.meta.env.VITE_STREAM_SERVER_HOST || '172.30.14.57'}:10800/api`

/**
 * 直播流管理组合式函数
 * 用于获取直播列表并管理 WebRTC 视频流播放
 */
export function useLiveStream() {
  const liveList = ref([])
  const currentStream = ref(null)
  const webrtcUrl = ref('')
  const isLoading = ref(false)
  const error = ref(null)

  /**
   * 获取直播列表
   * @param {Object} params 查询参数
   * @param {string} params.state 直播状态：all(默认)/living/unstart
   * @param {string} params.q 查询条件(JSON格式)
   * @param {number} params.start 起始页码，默认1
   * @param {number} params.limit 每页数量
   * @returns {Promise<Array>} 直播列表
   */
  async function fetchLiveList(params = {}) {
    isLoading.value = true
    error.value = null

    try {
      const queryParams = new URLSearchParams()
      if (params.state) queryParams.append('state', params.state)
      if (params.q) queryParams.append('q', params.q)
      if (params.start) queryParams.append('start', params.start)
      if (params.limit) queryParams.append('limit', params.limit)
      if (params.sort) queryParams.append('sort', params.sort)
      if (params.order) queryParams.append('order', params.order)

      const url = `${STREAM_API_BASE}/v1/live/list?${queryParams.toString()}`

      const token = localStorage.getItem('token')
      const response = await fetch(url, {
        headers: {
          'Authorization': `Bearer ${token || ''}`
        }
      })
      const result = await response.json()

      if (result.code === 200) {
        liveList.value = result.data?.rows || []
        console.log('[LiveStream] 获取直播列表成功:', liveList.value)
        return liveList.value
      } else {
        throw new Error(result.msg || '获取直播列表失败')
      }
    } catch (err) {
      error.value = err.message
      console.error('[LiveStream] 获取直播列表失败:', err)
      return []
    } finally {
      isLoading.value = false
    }
  }

  /**
   * 根据设备ID获取WebRTC播放地址
   * @param {string} deviceId 设备ID
   * @returns {Promise<string|null>} WebRTC播放地址
   */
  async function getWebRTCUrlByDeviceId(deviceId) {
    if (!deviceId) {
      console.warn('[LiveStream] 设备ID为空，无法获取播放地址')
      return null
    }

    console.log('[LiveStream] 正在查询设备直播流:', deviceId)

    // 使用设备ID作为关键字查询
    const query = JSON.stringify({ keyWord: deviceId })
    const list = await fetchLiveList({ state: 'living', q: query })

    // 根据设备ID查找匹配的直播流（cid字段对应DeviceId）
    const deviceStream = list.find(item => {
      const matchCid = String(item.cid) === String(deviceId)
      const isPushing = item.pushIng === true
      const hasWebRTC = !!item.session?.WEBRTC
      return matchCid && isPushing && hasWebRTC
    })

    if (deviceStream) {
      selectStream(deviceStream)
      console.log('[LiveStream] 找到设备直播流:', deviceId, 'WebRTC地址:', webrtcUrl.value)
      return webrtcUrl.value
    }

    console.warn('[LiveStream] 未找到设备的直播流:', deviceId)
    return null
  }

  /**
   * 选择直播流
   * @param {Object} stream 直播流对象
   */
  function selectStream(stream) {
    currentStream.value = stream
    webrtcUrl.value = stream?.session?.WEBRTC || ''
    console.log('[LiveStream] 选择直播流:', stream?.name, 'WebRTC地址:', webrtcUrl.value)
  }

  /**
   * 获取第一个可用的 WebRTC 流地址
   * 根据后端参数，只选择 pushIng=true（正在直播中）的流
   * @returns {string|null} WebRTC 地址
   */
  function getFirstWebRTCUrl() {
    // 过滤条件：有 WebRTC 地址且正在直播中（pushIng=true）
    const firstLive = liveList.value.find(item => {
      const hasWebRTC = item.session?.WEBRTC
      const isPushing = item.pushIng === true
      return hasWebRTC && isPushing
    })

    if (firstLive) {
      selectStream(firstLive)
      return webrtcUrl.value
    }

    // 如果没有正在直播的流，检查是否有未直播但有地址的流
    const inactiveStream = liveList.value.find(item => item.session?.WEBRTC)
    if (inactiveStream) {
      console.warn('[LiveStream] 找到直播流但未在直播中 (pushIng=false):', inactiveStream.name)
    }

    return null
  }

  /**
   * 自动获取并连接第一个可用直播流
   * @returns {Promise<string|null>} WebRTC 地址
   */
  async function autoConnect() {
    await fetchLiveList({ state: 'living' })
    return getFirstWebRTCUrl()
  }

  /**
   * 断开当前流
   */
  function disconnect() {
    currentStream.value = null
    webrtcUrl.value = ''
    console.log('[LiveStream] 断开直播流')
  }

  onUnmounted(() => {
    disconnect()
  })

  return {
    liveList,
    currentStream,
    webrtcUrl,
    isLoading,
    error,
    fetchLiveList,
    selectStream,
    getFirstWebRTCUrl,
    getWebRTCUrlByDeviceId,
    autoConnect,
    disconnect
  }
}
