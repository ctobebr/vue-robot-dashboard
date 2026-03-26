# 3D Viewer (Vue 3 重构版)

这是一个基于 Vue 3、Three.js、Pinia、Vite 构建的 3D 点云查看器项目，是对原 React 版本的完整重构。

## 技术栈

- **Vue 3** - 使用 Composition API
- **Three.js** - 3D 渲染库
- **Pinia** - 状态管理
- **Vite** - 构建工具
- **TypeScript** - 类型安全
- **i18next** - 国际化
- **Socket.io-client** - WebSocket 通信
- **@loaders.gl** - Draco 压缩点云数据加载

## 项目结构

```
vue-3d-viewer/
├── public/                 # 静态资源
│   ├── fonts/             # 字体文件
│   ├── draco-loader.worker.js
│   ├── draco_decoder.wasm
│   ├── draco_encoder.js
│   └── draco_wasm_wrapper.js
├── src/
│   ├── components/        # 组件
│   │   ├── Header/       # 头部组件
│   │   ├── Toolbar/      # 工具栏组件
│   │   └── Viewer/       # 3D 查看器组件
│   ├── composables/      # Vue 组合式函数
│   │   └── useSocket.ts  # Socket 通信
│   ├── locales/          # 国际化文件
│   │   ├── en/
│   │   └── zh/
│   ├── pages/            # 页面组件
│   │   └── HomePage.vue  # 主页
│   ├── router/           # 路由配置
│   │   └── index.ts
│   ├── stores/           # Pinia 状态管理
│   │   ├── setting.ts    # 设置状态
│   │   └── device.ts     # 设备状态
│   ├── App.vue           # 根组件
│   ├── main.ts           # 入口文件
│   ├── i18n.ts           # 国际化配置
│   ├── style.css         # 全局样式
│   └── vite-env.d.ts     # Vite 类型声明
├── .env                   # 环境变量
├── index.html             # HTML 入口
├── package.json
├── tsconfig.json
├── vite.config.ts
└── README.md
```

## 核心功能

### 1. 点云渲染模块

**核心算法和优化技术：**

1. **Draco 压缩加载**
   - 使用 `@loaders.gl/draco` 加载压缩的点云数据
   - 显著减少数据传输量和内存占用

2. **自定义 Shader 渲染**
   - 顶点着色器实现裁剪逻辑
   - 片段着色器处理点云和透明度
   - 支持点大小衰减（size attenuation）

3. **内存管理优化**
   - 分批次存储点云数据（firstPoints 和 thirdPoints）
   - 限制最大缓存数量（演示模式 100 个，工作模式 3000 个）
   - 自动移除最早的数据

4. **裁剪技术**
   - 支持自定义裁剪盒（可旋转、缩放、平移）
   - 支持高度范围裁剪
   - 在 Shader 中实现高效裁剪

### 2. 状态管理（Pinia）

- **setting store** - 管理应用设置
  - 外观设置（点云、刻度板、坐标轴等）
  - 相机设置（FOV、跟随模式等）
  - 工具设置（裁剪、性能统计）
  - 使用 sessionStorage 持久化

- **device store** - 管理设备状态
  - 设备 SN、状态（在线/离线/建图/错误）
  - 录制状态和时间
  - 资源使用率（CPU、内存、磁盘）
  - 网络配置

### 3. Socket 通信

- 使用 `provide/inject` 机制提供全局 Socket 实例
- 自动重连机制
- 监听 `BaseStatus`、`RecordStatus`、`PointCloud` 等事件

## 与原 React 版本的对比

| 功能 | React 版本 | Vue 3 版本 |
|------|-----------|-----------|
| UI 框架 | React 18 | Vue 3 |
| 状态管理 | Zustand | Pinia |
| 3D 渲染 | React Three Fiber | 原生 Three.js |
| 构建工具 | Vite | Vite |
| 国际化 | react-i18next | i18next-vue |
| Context | React Context | Vue provide/inject |

## 安装和运行

```bash
# 安装依赖
npm install

# 开发模式
npm run dev

# 生产构建
npm run build

# 类型检查
npm run typecheck

# 预览构建结果
npm run preview
```

## 环境变量

需要创建 `.env` 文件：

```env
VITE_DEVICE_SN=your_device_serial_number
```

## 点云渲染核心技术详解

### 1. 自定义 Shader Material

项目使用 `THREE.ShaderMaterial` 实现高度定制化的点云渲染：

```typescript
const pointCloudMaterial = new THREE.ShaderMaterial({
  uniforms: {
    size: { value: 0.1 },
    opacity: { value: 0.3 },
    clipBoxPosition1: { value: new THREE.Vector3(0, 0, 0) },
    // ... 更多 uniform
  },
  vertexShader: `...`,  // 顶点着色器
  fragmentShader: `...`, // 片段着色器
  vertexColors: true,
  transparent: true
})
```

### 2. 顶点着色器裁剪

在顶点着色器中实现裁剪逻辑，避免不必要的渲染：

```glsl
bool isInsideBox(vec3 point, vec3 boxPosition, vec3 boxRotation, vec3 boxScale) {
  // 旋转矩阵计算
  mat4 rotationMatrix = mat4(...);
  vec3 localPos = vec3(inverse(rotationMatrix) * vec4(point, 1.0));
  
  // 边界检测
  return localPos.x > -boxScale.x/2.0 && localPos.x < boxScale.x/2.0 &&
         localPos.y > -boxScale.y/2.0 && localPos.y < boxScale.y/2.0 &&
         localPos.z > -boxScale.z/2.0 && localPos.z < boxScale.z/2.0;
}
```

### 3. 点大小衰减

根据相机距离动态调整点大小：

```glsl
if (sizeAttenuation) {
  gl_PointSize = size * (30.0 / -mvPosition.z);
} else {
  gl_PointSize = size * 10.0;
}
```

## 性能优化策略

1. **BufferGeometry 而非 Geometry**
   - 使用 `THREE.BufferGeometry` 提高渲染性能
   - 数据存储在 GPU 缓冲区中

2. **分批次渲染**
   - 将点云分成多个小的 geometry
   - 避免单个过大的 buffer

3. **Shader 级别裁剪**
   - 在 GPU 上进行裁剪，减少绘制调用
   - 使用 discard 指令丢弃不需要的片段

4. **响应式更新**
   - 使用 Vue 的 watch 监听状态变化
   - 仅在必要时更新 Three.js 对象

## 注意事项

1. **WebGL 上下文**
   - 确保浏览器支持 WebGL
   - 注意内存管理，及时 dispose 不用的对象

2. **Socket 连接**
   - 后端服务需要运行在 `http://{hostname}:8000`
   - 需要正确配置设备 SN

3. **Draco 解码器**
   - 确保 WASM 文件正确加载
   - public 目录中的相关文件必须存在

## 后续改进方向

1. **完整集成点云组件**
   - 当前 Viewer 组件已包含基础 3D 场景
   - 需要进一步集成 PointCloud、Location、Footprint 等组件

2. **添加 TresJS 或 Vue Three Fiber**
   - 可以考虑使用 `tresjs` 或 `vue-three-fiber` 简化 Three.js 集成

3. **完善 UI 组件**
   - 添加侧边栏设置面板
   - 实现更丰富的交互控件

4. **添加测试**
   - 单元测试
   - E2E 测试

## 许可证

与原项目保持一致。
