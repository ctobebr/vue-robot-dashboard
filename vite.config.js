import { defineConfig } from 'vite'
import vue from '@vitejs/plugin-vue'
import path from 'path'

export default defineConfig({
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
    port: 5173,
    proxy: {
      '/api': {
        // target: 'http://192.168.123.38:8080',  // ← 切回原服务器
        target: 'http://172.30.14.57:8080',  // 测试服务器
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
        target: 'http://172.30.14.57:10800',  // 推流服务
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
})
