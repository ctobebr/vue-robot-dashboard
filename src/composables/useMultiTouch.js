import { ref } from 'vue'

const touchMapping = ref(new Map())
const joystickRegistry = ref(new Map())

/**
 * @typedef {Object} JoystickRegistryEntry
 * @property {string} id 摇杆唯一标识符
 * @property {HTMLElement} element 摇杆DOM元素
 * @property {JoystickCallbacks} callbacks 回调函数集合
 */

/**
 * @typedef {Object} JoystickCallbacks
 * @property {Function} onTouchStart 触摸开始回调
 * @property {Function} onTouchMove 触摸移动回调
 * @property {Function} onTouchEnd 触摸结束回调
 */

/**
 * 多触摸管理组合式函数
 * 管理多个摇杆的触摸事件，实现单个触摸点精确追踪对应摇杆
 * @returns {Object} 包含触摸管理方法的对象
 */
export function useMultiTouch() {
  /**
   * 注册摇杆到管理系统
   * @param {string} id 摇杆唯一标识符
   * @param {HTMLElement} element 摇杆DOM元素
   * @param {JoystickCallbacks} callbacks 回调函数集合
   * @returns {void}
   */
  function registerJoystick(id, element, callbacks) {
    joystickRegistry.value.set(id, {
      id,
      element,
      callbacks
    })
  }

  /**
   * 注销摇杆从管理系统
   * 同时清除该摇杆关联的所有触摸映射
   * @param {string} id 摇杆唯一标识符
   * @returns {void}
   */
  function unregisterJoystick(id) {
    joystickRegistry.value.delete(id)
    for (const [touchId, joystickId] of touchMapping.value.entries()) {
      if (joystickId === id) {
        touchMapping.value.delete(touchId)
      }
    }
  }

  /**
   * 根据触摸位置查找对应摇杆
   * @param {number} clientX 客户端X坐标
   * @param {number} clientY 客户端Y坐标
   * @returns {string|null} 摇杆ID，未找到则返回null
   */
  function findJoystickByPosition(clientX, clientY) {
    for (const [id, joystick] of joystickRegistry.value.entries()) {
      if (joystick.element) {
        const rect = joystick.element.getBoundingClientRect()
        if (
          clientX >= rect.left &&
          clientX <= rect.right &&
          clientY >= rect.top &&
          clientY <= rect.bottom
        ) {
          return id
        }
      }
    }
    return null
  }

  /**
   * 处理触摸开始事件
   * 查找触摸点对应的摇杆并触发相应回调
   * @param {TouchEvent} event 触摸事件对象
   * @returns {void}
   */
  function handleTouchStart(event) {
    for (let i = 0; i < event.changedTouches.length; i++) {
      const touch = event.changedTouches[i]
      const joystickId = findJoystickByPosition(touch.clientX, touch.clientY)

      if (joystickId) {
        touchMapping.value.set(touch.identifier, joystickId)
        const joystick = joystickRegistry.value.get(joystickId)
        if (joystick && joystick.callbacks && joystick.callbacks.onTouchStart) {
          joystick.callbacks.onTouchStart(touch)
        }
      }
    }
  }

  /**
   * 处理触摸移动事件
   * 根据触摸ID查找对应摇杆并触发移动回调
   * @param {TouchEvent} event 触摸事件对象
   * @returns {void}
   */
  function handleTouchMove(event) {
    for (let i = 0; i < event.changedTouches.length; i++) {
      const touch = event.changedTouches[i]
      const joystickId = touchMapping.value.get(touch.identifier)

      if (joystickId) {
        const joystick = joystickRegistry.value.get(joystickId)
        if (joystick && joystick.callbacks && joystick.callbacks.onTouchMove) {
          joystick.callbacks.onTouchMove(touch)
        }
      }
    }
  }

  /**
   * 处理触摸结束事件
   * 根据触摸ID查找对应摇杆并触发结束回调，同时清除触摸映射
   * @param {TouchEvent} event 触摸事件对象
   * @returns {void}
   */
  function handleTouchEnd(event) {
    for (let i = 0; i < event.changedTouches.length; i++) {
      const touch = event.changedTouches[i]
      const joystickId = touchMapping.value.get(touch.identifier)

      if (joystickId) {
        const joystick = joystickRegistry.value.get(joystickId)
        if (joystick && joystick.callbacks && joystick.callbacks.onTouchEnd) {
          joystick.callbacks.onTouchEnd(touch)
        }
        touchMapping.value.delete(touch.identifier)
      }
    }
  }

  return {
    registerJoystick,
    unregisterJoystick,
    handleTouchStart,
    handleTouchMove,
    handleTouchEnd
  }
}

let globalMultiTouchInstance = null
const listenersAttached = ref(false)

/**
 * 设置全局多触摸监听器
 * 在文档级别注册touchstart、touchmove、touchend、touchcancel事件
 * @param {Function} [getElement] 可选的获取元素函数（已废弃参数）
 * @returns {void}
 */
export function setupGlobalMultiTouchListeners(getElement) {
  if (listenersAttached.value) return

  const multiTouch = useMultiTouch()
  globalMultiTouchInstance = multiTouch

  document.addEventListener('touchstart', multiTouch.handleTouchStart, { passive: false })
  document.addEventListener('touchmove', multiTouch.handleTouchMove, { passive: false })
  document.addEventListener('touchend', multiTouch.handleTouchEnd)
  document.addEventListener('touchcancel', multiTouch.handleTouchEnd)

  listenersAttached.value = true
}

/**
 * 获取全局多触摸实例
 * @returns {Object|null} 全局多触摸实例
 */
export function getMultiTouch() {
  return globalMultiTouchInstance
}
