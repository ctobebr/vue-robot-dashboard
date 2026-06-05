<template>
  <div class="webrtc-player">
    <video
      ref="videoRef"
      class="video-element"
      autoplay
      playsinline
      muted
    ></video>
    <div v-if="status !== 'playing'" class="status-overlay">
      <el-icon v-if="status === 'connecting'" class="loading"><Loading /></el-icon>
      <el-icon v-else-if="status === 'error'" class="error"><CircleClose /></el-icon>
      <span class="status-text">{{ statusText }}</span>
    </div>
    <!-- 视频统计信息 -->
    <!-- <div v-if="showStats && stats" class="stats-overlay">
      <div class="stats-item">
        <span class="stats-label">分辨率:</span>
        <span class="stats-value">{{ stats.resolution }}</span>
      </div>
      <div class="stats-item">
        <span class="stats-label">码率:</span>
        <span class="stats-value">{{ stats.bitrate }}</span>
      </div>
      <div class="stats-item">
        <span class="stats-label">帧率:</span>
        <span class="stats-value">{{ stats.framerate }}</span>
      </div>
      <div class="stats-item">
        <span class="stats-label">丢包:</span>
        <span class="stats-value" :class="{ 'stats-warning': stats.packetLoss > 1 }">{{ stats.packetLoss }}%</span>
      </div>
      <div class="stats-item">
        <span class="stats-label">延迟:</span>
        <span class="stats-value" :class="{ 'stats-warning': stats.delay > 200 }">{{ stats.delay }}</span>
      </div>
    </div> -->
  </div>
</template>

<script setup>
import { ref, watch, onUnmounted } from 'vue'
import { ElIcon } from 'element-plus'
import { Loading, CircleClose } from '@element-plus/icons-vue'

const props = defineProps({
  url: {
    type: String,
    required: true
  },
  showStats: {
    type: Boolean,
    default: true  // 默认显示统计信息
  }
})

const videoRef = ref(null)
const status = ref('idle') // idle, connecting, playing, error
const statusText = ref('等待连接')
const pc = ref(null)
const stats = ref(null)
const statsTimer = ref(null)
const prevBytesReceived = ref(0)
const prevStatsTime = ref(0)
const prevPacketsLost = ref(0)
const prevPacketsReceived = ref(0)
const prevJitterDelay = ref(0)
const prevJitterCount = ref(0)

// 加载 ZLMRTCClient
function loadScript(src) {
  return new Promise((resolve, reject) => {
    if (document.querySelector(`script[src="${src}"]`)) {
      resolve()
      return
    }
    const script = document.createElement('script')
    script.src = src
    script.onload = resolve
    script.onerror = reject
    document.head.appendChild(script)
  })
}

// 获取视频统计信息
async function updateStats() {
  if (!pc.value || !videoRef.value) return

  try {
    // 尝试多种方式获取 RTCPeerConnection 实例
    let pcInstance = null
    if (pc.value.pc) {
      pcInstance = pc.value.pc
    } else if (pc.value._pc) {
      pcInstance = pc.value._pc
    } else if (pc.value.getPeerConnection) {
      pcInstance = pc.value.getPeerConnection()
    }

    if (!pcInstance) {
      console.warn('[WebRTC] 无法获取 PeerConnection 实例')
      return
    }

    const statsReport = await pcInstance.getStats()
    let videoTrackStats = null
    let inboundRtpStats = null

    statsReport.forEach((report) => {
      // 查找视频轨道统计 (track 类型)
      if (report.type === 'track' && report.kind === 'video') {
        videoTrackStats = report
      }
      // 查找入站 RTP 统计 (inbound-rtp 类型)
      if (report.type === 'inbound-rtp' && (report.kind === 'video' || report.mediaType === 'video')) {
        inboundRtpStats = report
      }
    })

    // 分辨率和帧率从 track 报告获取（更准确）
    const trackData = videoTrackStats || inboundRtpStats
    if (!trackData && !inboundRtpStats) return

    const width = trackData?.frameWidth || 0
    const height = trackData?.frameHeight || 0
    const fps = trackData?.framesPerSecond || 0

    // 计算码率（使用 bytesReceived 差值）
    let bitrate = '-'
    if (inboundRtpStats && inboundRtpStats.bytesReceived && inboundRtpStats.timestamp) {
      const nowBytes = inboundRtpStats.bytesReceived
      const nowTime = inboundRtpStats.timestamp
      if (prevBytesReceived.value > 0 && prevStatsTime.value > 0) {
        const bytesDelta = nowBytes - prevBytesReceived.value
        const timeDeltaSec = (nowTime - prevStatsTime.value) / 1000
        if (timeDeltaSec > 0 && bytesDelta > 0) {
          bitrate = `${Math.round((bytesDelta * 8) / timeDeltaSec / 1000)} kbps`
        }
      }
      prevBytesReceived.value = nowBytes
      prevStatsTime.value = nowTime
    }

    // 计算实时丢包率（增量方式）
    let packetLoss = '0.00'
    if (inboundRtpStats) {
      const curLost = inboundRtpStats.packetsLost || 0
      const curReceived = inboundRtpStats.packetsReceived || 0
      if (prevPacketsLost.value > 0 || prevPacketsReceived.value > 0) {
        const lostDelta = curLost - prevPacketsLost.value
        const receivedDelta = curReceived - prevPacketsReceived.value
        const totalDelta = lostDelta + receivedDelta
        if (totalDelta > 0) {
          packetLoss = ((lostDelta / totalDelta) * 100).toFixed(2)
        }
      }
      prevPacketsLost.value = curLost
      prevPacketsReceived.value = curReceived
    }

    // 计算实时延迟（增量方式）
    let delay = '-'
    if (inboundRtpStats && inboundRtpStats.jitterBufferDelay !== undefined && inboundRtpStats.jitterBufferEmittedCount > 0) {
      const curDelay = inboundRtpStats.jitterBufferDelay
      const curCount = inboundRtpStats.jitterBufferEmittedCount
      if (prevJitterCount.value > 0) {
        const countDelta = curCount - prevJitterCount.value
        const delayDelta = curDelay - prevJitterDelay.value
        if (countDelta > 0) {
          const instantDelayMs = Math.round((delayDelta / countDelta) * 1000)
          delay = `${instantDelayMs} ms`
        }
      }
      prevJitterDelay.value = curDelay
      prevJitterCount.value = curCount
    }

    stats.value = {
      resolution: width && height ? `${width}x${height}` : '-',
      framerate: fps ? `${fps} fps` : '-',
      bitrate: bitrate,
      packetLoss: packetLoss,
      delay: delay
    }
  } catch (err) {
    // 统计信息获取失败不报错
  }
}

async function initWebRTC() {
  if (!props.url) return

  status.value = 'connecting'
  statusText.value = '正在连接...'
  stats.value = null

  try {
    // 加载 ZLMRTCClient.js（从 ZLMediaKit 服务器获取）
    const zlmHost = new URL(props.url).host
    await loadScript(`http://${zlmHost}/webrtc/ZLMRTCClient.js`)

    const ZLMRTCClient = window.ZLMRTCClient
    if (!ZLMRTCClient) {
      throw new Error('ZLMRTCClient 加载失败')
    }

    // 关闭之前的连接
    if (pc.value) {
      pc.value.close()
      pc.value = null
    }

    // 清除之前的统计定时器
    if (statsTimer.value) {
      clearInterval(statsTimer.value)
      statsTimer.value = null
    }
    prevBytesReceived.value = 0
    prevStatsTime.value = 0
    prevPacketsLost.value = 0
    prevPacketsReceived.value = 0
    prevJitterDelay.value = 0
    prevJitterCount.value = 0

    // 创建 RTC 客户端
    pc.value = new ZLMRTCClient.Endpoint({
      element: videoRef.value,
      debug: false,  // 关闭详细日志，避免输出SDP信令
      zlmsdpUrl: props.url,
      simulcast: false,
      useCamera: false,
      audioEnable: false,
      videoEnable: true,
      recvOnly: true
    })

    // 监听事件
    pc.value.on(ZLMRTCClient.Events.WEBRTC_ICE_CANDIDATE_ERROR, (e) => {
      console.error('[WebRTC] ICE 候选错误:', e)
      status.value = 'error'
      statusText.value = '连接失败'
    })

    pc.value.on(ZLMRTCClient.Events.WEBRTC_OFFER_ANWSER_EXCHANGE_FAILED, (e) => {
      console.error('[WebRTC] Offer/Answer 交换失败:', e)
      status.value = 'error'
      statusText.value = '信令交换失败'
    })

    pc.value.on(ZLMRTCClient.Events.WEBRTC_ON_REMOTE_STREAMS, (e) => {
      console.log('[WebRTC] 收到远程流:', e)
      status.value = 'playing'
      statusText.value = '播放中'
      // 开始定时更新统计信息
      statsTimer.value = setInterval(updateStats, 2000)
    })

    pc.value.on(ZLMRTCClient.Events.WEBRTC_ON_CONNECTION_STATE_CHANGE, (state) => {
      console.log('[WebRTC] 连接状态变化:', state)
      if (state === 'connected') {
        status.value = 'playing'
        statusText.value = '播放中'
      } else if (state === 'failed' || state === 'disconnected') {
        status.value = 'error'
        statusText.value = '连接断开'
        if (statsTimer.value) {
          clearInterval(statsTimer.value)
          statsTimer.value = null
        }
      }
    })

  } catch (err) {
    console.error('[WebRTC] 初始化失败:', err)
    status.value = 'error'
    statusText.value = '初始化失败: ' + (err?.message || '未知错误')
  }
}

function stop() {
  if (pc.value) {
    pc.value.close()
    pc.value = null
  }
  if (statsTimer.value) {
    clearInterval(statsTimer.value)
    statsTimer.value = null
  }
  status.value = 'idle'
  statusText.value = '已停止'
  stats.value = null
}

// 监听 URL 变化
watch(() => props.url, (newUrl) => {
  if (newUrl) {
    initWebRTC()
  } else {
    stop()
  }
}, { immediate: true })

onUnmounted(() => {
  stop()
})

defineExpose({
  initWebRTC,
  stop
})
</script>

<style scoped>
.webrtc-player {
  position: relative;
  width: 100%;
  height: 100%;
  background-color: #000;
}

.video-element {
  width: 100%;
  height: 100%;
  object-fit: cover;
}

.status-overlay {
  position: absolute;
  top: 0;
  left: 0;
  width: 100%;
  height: 100%;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  background-color: rgba(0, 0, 0, 0.7);
  color: #fff;
  gap: 8px;
}

.status-overlay .loading {
  font-size: 32px;
  animation: spin 1s linear infinite;
}

.status-overlay .error {
  font-size: 32px;
  color: #ff4d4f;
}

.status-text {
  font-size: 14px;
}

/* 统计信息样式 */
.stats-overlay {
  position: absolute;
  top: 8px;
  left: 8px;
  background-color: rgba(0, 0, 0, 0.6);
  border-radius: 4px;
  padding: 8px 12px;
  color: #fff;
  font-size: 12px;
  font-family: monospace;
  display: flex;
  flex-direction: column;
  gap: 4px;
  min-width: 120px;
}

.stats-item {
  display: flex;
  justify-content: space-between;
  gap: 12px;
}

.stats-label {
  color: #aaa;
}

.stats-value {
  color: #0f0;
  font-weight: bold;
}

.stats-warning {
  color: #ff4d4f;
}

@keyframes spin {
  from { transform: rotate(0deg); }
  to { transform: rotate(360deg); }
}
</style>
