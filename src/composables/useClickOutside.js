import { ref, onMounted, onUnmounted, nextTick } from 'vue'

/**
 * 检查点击是否在 Element Plus 弹出层内部
 * @param {Event} event - 点击事件
 * @returns {boolean} 是否在弹出层内部
 */
function isClickInElementPlusPopper(event) {
  const popperSelectors = [
    '.el-popover',
    '.el-popper',
    '.el-select-dropdown',
    '.el-color-dropdown',
    '.el-cascader__dropdown',
    '.el-picker-panel',
    '.el-dropdown-menu',
    '.el-tooltip'
  ]

  for (const selector of popperSelectors) {
    const elements = document.querySelectorAll(selector)
    for (const element of elements) {
      if (element === event.target || element.contains(event.target)) {
        return true
      }
    }
  }
  return false
}

/**
 * 点击外部关闭组件的 composable
 * @param {Ref} targetRef - 目标组件的 ref
 * @param {Ref} triggerRef - 触发按钮的 ref（可选）
 * @param {Function} onClose - 关闭回调函数
 * @param {Ref} isOpen - 是否打开的响应式引用
 */
export function useClickOutside(targetRef, triggerRef, onClose, isOpen) {
  const isAnimating = ref(false)

  const handleClickOutside = async (event) => {
    // 如果组件未打开，不处理
    if (!isOpen.value) return

    // 如果正在动画中，不处理
    if (isAnimating.value) return

    // 等待 DOM 更新完成
    await nextTick()

    const target = targetRef.value
    const trigger = triggerRef?.value

    // 检查点击是否在目标组件内部
    if (target && (target === event.target || target.contains(event.target))) {
      return
    }

    // 检查点击是否在触发按钮上
    if (trigger && (trigger === event.target || trigger.contains(event.target))) {
      return
    }

    // 检查点击是否在 Element Plus 弹出层内部（特殊处理）
    if (isClickInElementPlusPopper(event)) {
      return
    }

    // 触发关闭
    onClose()
  }

  const startCloseAnimation = () => {
    isAnimating.value = true
    setTimeout(() => {
      isAnimating.value = false
    }, 300) // 与 CSS 动画时间一致
  }

  onMounted(() => {
    // 使用 capture 阶段确保在事件冒泡前处理
    document.addEventListener('click', handleClickOutside, true)
  })

  onUnmounted(() => {
    document.removeEventListener('click', handleClickOutside, true)
  })

  return {
    isAnimating,
    startCloseAnimation
  }
}

/**
 * 管理多个弹出组件的状态，确保只有一个组件处于打开状态
 */
export function usePopupManager() {
  const popups = ref(new Set())
  const currentOpenPopup = ref(null)

  const registerPopup = (name) => {
    popups.value.add(name)
  }

  const unregisterPopup = (name) => {
    popups.value.delete(name)
  }

  const openPopup = (name) => {
    // 关闭当前打开的组件
    if (currentOpenPopup.value && currentOpenPopup.value !== name) {
      const event = new CustomEvent('close-popup', { detail: { name: currentOpenPopup.value } })
      document.dispatchEvent(event)
    }
    currentOpenPopup.value = name
  }

  const closePopup = () => {
    currentOpenPopup.value = null
  }

  return {
    popups,
    currentOpenPopup,
    registerPopup,
    unregisterPopup,
    openPopup,
    closePopup
  }
}
