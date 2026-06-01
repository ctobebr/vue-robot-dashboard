import { defineConfig, loadEnv } from 'vite'
import vue from '@vitejs/plugin-vue'
import path from 'path'

export default defineConfig(({ mode }) => {
  // 加载环境变量
  const env = loadEnv(mode, process.cwd(), '')
  
  // 从环境变量读取服务器配置
  const serverIp = env.VITE_SERVER_IP || '172.30.1.132'
  const serverPort = env.VITE_SERVER_PORT || '8080'
  const streamPort = env.VITE_STREAM_PORT || '10800'
  
  const serverUrl = `http://${serverIp}:${serverPort}`
  const streamUrl = `http://${serverIp}:${streamPort}`
  
  console.log('[Vite Config] 服务器地址:', serverUrl)
  console.log('[Vite Config] 推流地址:', streamUrl)

  return {
    plugins: [vue()],
    resolve: {
      alias: {
        '@': path.resolve(__dirname, './src')
      }
    },
    define: {
      // 修复 sockjs-client 的 global 问题
      global: 'globalThis',
    },
    server: {
      host: true,
      port: 5173,
      proxy: {
        '/api': {
          target: serverUrl,
          changeOrigin: true,
          configure: (proxy, options) => {
            proxy.on('proxyReq', (proxyReq, req, res) => {
              console.log('[代理]', req.method, req.url, '->', options.target + req.url)
            })
            proxy.on('proxyRes', (proxyRes, req, res) => {
              console.log('[代理响应]', proxyRes.statusCode, req.url)
            })
          },
          rewrite: (path) => path.replace(/^\/api/, '/api')
        },
        '/live-api': {
          target: streamUrl,
          changeOrigin: true,
          configure: (proxy, options) => {
            proxy.on('proxyReq', (proxyReq, req, res) => {
              console.log('[推流代理]', req.method, req.url, '->', options.target + req.url)
            })
          },
          rewrite: (path) => path.replace(/^\/live-api/, '/api')
        }
      }
    }
  }
})
