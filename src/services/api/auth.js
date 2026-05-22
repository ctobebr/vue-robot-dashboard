import request from '../request'

/**
 * 获取图形验证码
 * @returns {Promise} 包含验证码key和图片base64
 */
export function getCaptcha() {
  return request({
    url: '/users/captcha/image',
    method: 'get'
  })
}

/**
 * 用户登录
 * @param {Object} data 登录参数
 * @param {string} data.username 用户名
 * @param {string} data.password 密码
 * @param {string} data.captchaKey 验证码key
 * @param {string} data.captchaCode 验证码
 * @returns {Promise} 登录结果
 */
export function login(data) {
  return request({
    url: '/users/login',
    method: 'post',
    data
  })
}

/**
 * 用户注册
 * @param {Object} data 注册参数
 * @param {string} data.username 用户名
 * @param {string} data.phone 手机号
 * @param {string} data.password 密码
 * @param {string} data.captchaKey 验证码key
 * @param {string} data.captchaCode 验证码
 * @returns {Promise} 注册结果
 */
export function register(data) {
  return request({
    url: '/users/register',
    method: 'post',
    data
  })
}

/**
 * 退出登录
 * @returns {Promise}
 */
export function logout() {
  return request({
    url: '/users/logout',
    method: 'post'
  })
}

/**
 * 获取当前登录用户信息（/api/users/me）
 * @returns {Promise}
 */
export function getCurrentUser() {
  return request({
    url: '/users/me',
    method: 'get'
  })
}

/**
 * 获取所有用户列表（/api/users/getAllUsers）
 * @returns {Promise}
 */
export function getAllUsers() {
  return request({
    url: '/users/getAllUsers',
    method: 'get'
  })
}

/**
 * 根据ID查询用户
 * @param {number} id 用户ID
 * @returns {Promise}
 */
export function getUserById(id) {
  return request({
    url: `/users/${id}`,
    method: 'get'
  })
}

/**
 * 更新用户信息
 * @param {number} id 用户ID
 * @param {Object} data 用户数据
 * @returns {Promise}
 */
export function updateUser(id, data) {
  return request({
    url: `/users/${id}`,
    method: 'put',
    data
  })
}

/**
 * 删除用户
 * @param {number} id 用户ID
 * @returns {Promise}
 */
export function deleteUser(id) {
  return request({
    url: `/users/${id}`,
    method: 'delete'
  })
}

/**
 * 获取当前用户信息（旧接口，保留兼容）
 * @returns {Promise}
 */
export function getUserInfo() {
  return request({
    url: '/users/info',
    method: 'get'
  })
}
