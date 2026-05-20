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
  server: {
    port: 5173,
    proxy: {
      '/api': {
        //     target: 'http://192.168.123.38:8080',
        target: 'http://172.30.14.57:8080',  // ← 切换到测试服务器
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
      }
    }
  }
})
