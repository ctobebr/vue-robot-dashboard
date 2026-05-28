/**
 * 协议消息构建工具
 * 根据 doc.md 中定义的协议格式构建消息体
 */

/**
 * 全局会话ID计数器
 * 整个应用共享同一个 sessionId 序列，用于追踪完整的交互流程
 */
let globalSessionId = 1

/**
 * 获取下一个会话ID
 * @returns {number}
 */
export function getNextSessionId() {
  return globalSessionId++
}

/**
 * 获取当前会话ID（不自增）
 * @returns {number}
 */
export function getCurrentSessionId() {
  return globalSessionId
}

/**
 * 命令码常量定义
 * 对应 doc.md 中的 CmdType 枚举
 */
export const CmdType = {
  // 设备上报 (1000-1999)
  CMD_TYPE_START: 1000,
  MAPPING_BASE_STATUS_UPLOAD: 1001,
  MAPPING_ODOM_UPLOAD: 1002,
  GO2_LOW_STATUS_UPLOAD: 1003,
  GO2_SPORT_MODE_STATUS_UPLOAD: 1004,

  // 控制命令 (3000-3999)
  CMD_DISPATCH: 3000,
  IMAGE_TRANSMIT_SET: 3001,
  MAPPING_CONTROL: 3002,
  POINT_DENSITY_SET: 3003,
  RECORD_CONTROL: 3004,
  MASK_POINT_CONTROL: 3005,
  GO2EDU_SPORT_CONTROL: 3006,
  GO2EDU_SPORT_MODE: 3007
}

/**
 * 创建协议消息基础结构
 * 符合 doc.md 中定义的协议格式
 *
 * @param {number} msgCmd - 消息命令码
 * @param {Object} data - 消息数据体
 * @param {Object} options - 可选配置
 * @param {number} options.sessionId - 指定会话ID（不指定则自增）
 * @param {string} options.protocolVersion - 协议版本
 * @param {number} options.msgType - 消息类型 (0: 消息, 1: 应答)
 * @returns {Object} 协议消息对象
 */
export function createProtocolMessage(msgCmd, data, options = {}) {
  return {
    session_id: options.sessionId ?? getNextSessionId(),
    protocol_version: options.protocolVersion ?? 'v1.0.0',
    timestamp: Date.now(),
    msg_type: options.msgType ?? 0,
    msg_cmd: msgCmd,
    data: data
  }
}

/**
 * 创建 WebSocket 发送的最终消息格式
 * @param {Object} command - 协议命令消息
 * @param {string} deviceId - 设备ID
 * @param {Object} parameters - 额外参数（可选）
 * @returns {Object} 最终消息对象
 */
export function createWebSocketMessage(command, deviceId, parameters = {}) {
  return {
    command: JSON.stringify(command),
    deviceId: deviceId,
    parameters: parameters
  }
}

// ==================== 便捷函数 ====================

/**
 * 创建录制控制消息
 * @param {'start'|'end'|'reset'|string} control - 控制类型（start/end/reset 或录制名称）
 * @param {Object} options - 可选配置
 * @returns {Object} 协议消息对象
 */
export function createRecordControlMessage(control, options = {}) {
  return createProtocolMessage(
    CmdType.RECORD_CONTROL,
    { record_control: control },
    options
  )
}

/**
 * 创建映射控制消息
 * @param {'start'|'end'|'reset'} control - 控制类型
 * @param {Object} options - 可选配置
 * @returns {Object} 协议消息对象
 */
export function createMappingControlMessage(control, options = {}) {
  return createProtocolMessage(
    CmdType.MAPPING_CONTROL,
    { mapping_control: control },
    options
  )
}

/**
 * 创建运动控制消息
 * @param {number} cmdVelX - X轴速度 [-100, 100]
 * @param {number} cmdVelY - Y轴速度 [-100, 100]
 * @param {number} cmdYaw - 旋转速度 [-100, 100]
 * @param {Object} options - 可选配置
 * @returns {Object} 协议消息对象
 */
export function createSportControlMessage(cmdVelX, cmdVelY, cmdYaw, options = {}) {
  return createProtocolMessage(
    CmdType.GO2EDU_SPORT_CONTROL,
    {
      cmd_velx: parseFloat(cmdVelX.toFixed(1)),
      cmd_vely: parseFloat(cmdVelY.toFixed(1)),
      cmd_yaw: parseFloat(cmdYaw.toFixed(1))
    },
    options
  )
}

/**
 * 创建图像传输设置消息
 * @param {boolean} enable - 是否使能图像传输
 * @param {Object} options - 可选配置
 * @returns {Object} 协议消息对象
 */
export function createImageTransmitMessage(enable, options = {}) {
  return createProtocolMessage(
    CmdType.IMAGE_TRANSMIT_SET,
    { image_transimit_en: enable },
    options
  )
}

/**
 * 创建点云密度设置消息
 * @param {1|2|3} density - 点云密度 (1: 低密度, 2: 中密度, 3: 高密度)
 * @param {Object} options - 可选配置
 * @returns {Object} 协议消息对象
 */
export function createPointDensityMessage(density, options = {}) {
  return createProtocolMessage(
    CmdType.POINT_DENSITY_SET,
    { point_density_value: density },
    options
  )
}

/**
 * 创建运动模式切换消息
 * @param {number} sportMode - 运动模式代码
 * @param {Object} options - 可选配置
 * @returns {Object} 协议消息对象
 */
export function createSportModeMessage(sportMode, options = {}) {
  return createProtocolMessage(
    CmdType.GO2EDU_SPORT_MODE,
    { sport_mode: sportMode },
    options
  )
}

// ==================== 运动模式常量 ====================

export const Go2SportMode = {
  Agile: 100,                // 灵动
  Damping: 1001,             // 阻尼
  StandLock: 1002,           // 站立锁定
  Squat1004: 1004,           // 蹲下 (对应1004)
  Squat2006: 2006,           // 蹲下 (对应2006)
  SocialActions: 1006,       // 打招呼/伸懒腰/舞蹈/拜年/比心/开心
  Sit: 1007,                 // 坐下
  JumpForward: 1008,         // 前跳
  Pounce: 1009,              // 扑人
  BalanceStand: 1013,        // 平衡站立
  Walk: 1015,                // 常规行走
  Run: 1016,                 // 常规跑步
  ContinuousMode: 1017,      // 常规续航
  Pose: 1091,                // 摆姿势
  Dodge: 2007,               // 闪避
  RunLegsTogether: 2008,     // 并腿跑
  BounceRun: 2009,           // 跳跃跑
  Classic: 2010,             // 经典
  Handstand: 2011,           // 倒立
  ForwardFlip: 2012,         // 前空翻
  BackwardFlip: 2013,        // 后空翻
  LeftFlip: 2014,            // 左空翻
  CrossStep: 2016,           // 交叉步
  Upright: 2017,             // 直立
  Traction: 2019             // 牵引
}
