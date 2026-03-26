<template>
  <div class="number-input-wrapper">
    <div class="number-input-container">
      <button
        class="number-input-button number-input-button-left"
        @mousedown.prevent="onButtonDown(-1)"
        @mouseup="onButtonUp"
        @mouseleave="onButtonUp"
        :disabled="disabled || readOnly"
      >
        <PhCaretLeft size="12" />
      </button>
      <input
        ref="inputRef"
        type="text"
        class="number-input-input"
        :value="displayValue"
        :placeholder="placeholder"
        :disabled="disabled"
        :readonly="readOnly"
        @input="onInput"
        @blur="onBlur"
        @keydown="onKeyDown"
        @mousedown="onPointerDown"
        @mouseup="onPointerUp"
        @mousemove="onPointerMove"
      />
      <button
        class="number-input-button number-input-button-right"
        @mousedown.prevent="onButtonDown(1)"
        @mouseup="onButtonUp"
        @mouseleave="onButtonUp"
        :disabled="disabled || readOnly"
      >
        <PhCaretRight size="12" />
      </button>
    </div>
  </div>
</template>

<script setup>
import { ref, computed, watch } from 'vue'
import { PhCaretLeft, PhCaretRight } from '@phosphor-icons/vue'

const props = defineProps({
  modelValue: {
    type: Number,
    default: undefined
  },
  max: {
    type: Number,
    default: undefined
  },
  min: {
    type: Number,
    default: undefined
  },
  precision: {
    type: Number,
    default: 2
  },
  readOnly: {
    type: Boolean,
    default: false
  },
  step: {
    type: Number,
    default: 1
  },
  placeholder: {
    type: String,
    default: ''
  },
  disabled: {
    type: Boolean,
    default: false
  }
})

const emit = defineEmits(['update:modelValue'])

const inputRef = ref(null)
const scrubValue = ref(0)
const isDragging = ref(false)
const isPressed = ref(false)
const pressInterval = ref(null)
const internalValue = ref('')

const clamp = (value, minVal, maxVal) => {
  if (value == undefined) return undefined
  let result = value
  if (minVal !== undefined) result = Math.max(result, minVal)
  if (maxVal !== undefined) result = Math.min(result, maxVal)
  return result
}

const formatValue = (value) => {
  if (value === undefined || value === null || isNaN(value)) return ''
  const clamped = clamp(value, props.min, props.max)
  if (clamped === undefined) return ''
  return clamped.toFixed(props.precision)
}

const updateValue = (newValue) => {
  if (props.disabled || props.readOnly) return

  const clampedValue = clamp(newValue, props.min, props.max)
  const fixedValue = clampedValue !== undefined 
    ? Number(clampedValue.toFixed(props.precision)) 
    : undefined
  
  // 只有当值真正改变时才 emit
  if (fixedValue !== props.modelValue) {
    emit('update:modelValue', fixedValue)
  }
  
  return fixedValue
}

const placeHolderValue = computed(() => {
  const num = Number(props.placeholder)
  return isFinite(num) ? num : undefined
})

const displayValue = computed(() => {
  // 如果输入框处于焦点状态，显示原始输入值
  if (inputRef.value === document.activeElement) {
    return internalValue.value
  }
  // 否则显示格式化后的值
  return formatValue(props.modelValue)
})

// 监听 modelValue 变化，更新内部值
watch(() => props.modelValue, (newVal) => {
  if (inputRef.value !== document.activeElement) {
    internalValue.value = formatValue(newVal)
  }
}, { immediate: true })

const onInput = (event) => {
  let value = event.target.value
  
  // 允许空值
  if (value === '' || value === '-') {
    internalValue.value = value
    if (value === '') {
      emit('update:modelValue', undefined)
    }
    return
  }
  
  // 解析数字
  const num = Number(value)
  
  // 如果不是有效数字，恢复原值
  if (isNaN(num)) {
    event.target.value = internalValue.value
    return
  }
  
  // 检查是否超出范围
  let isOutOfRange = false
  if (props.max !== undefined && num > props.max) {
    isOutOfRange = true
  }
  if (props.min !== undefined && num < props.min) {
    isOutOfRange = true
  }
  
  // 如果超出范围，限制输入
  if (isOutOfRange) {
    const clamped = clamp(num, props.min, props.max)
    internalValue.value = String(clamped)
    event.target.value = internalValue.value
    updateValue(clamped)
  } else {
    // 检查小数位数
    const decimalPart = value.split('.')[1]
    if (decimalPart && decimalPart.length > props.precision) {
      // 如果小数位数超过限制，截断
      const fixedValue = num.toFixed(props.precision)
      internalValue.value = fixedValue
      event.target.value = internalValue.value
      updateValue(Number(fixedValue))
    } else {
      internalValue.value = value
      updateValue(num)
    }
  }
}

const onBlur = () => {
  // 失去焦点时，强制格式化值
  const finalValue = updateValue(props.modelValue)
  internalValue.value = formatValue(finalValue)
}

const onKeyDown = (event) => {
  if (props.disabled || props.readOnly) return
  
  if (event.key === 'ArrowUp') {
    event.preventDefault()
    const scale = event.shiftKey ? 10 : 1
    const newValue = updateValue((props.modelValue ?? placeHolderValue.value ?? 0) + props.step * scale)
    internalValue.value = formatValue(newValue)
  } else if (event.key === 'ArrowDown') {
    event.preventDefault()
    const scale = event.shiftKey ? 10 : 1
    const newValue = updateValue((props.modelValue ?? placeHolderValue.value ?? 0) - props.step * scale)
    internalValue.value = formatValue(newValue)
  } else if (event.key === 'Enter') {
    // 回车时触发 blur 来格式化
    inputRef.value?.blur()
  }
}

const onPointerDown = (event) => {
  if (props.disabled || props.readOnly) return
  isDragging.value = true
  scrubValue.value = props.modelValue ?? placeHolderValue.value ?? 0
  if (!isFinite(scrubValue.value)) scrubValue.value = 0
}

const onPointerUp = (event) => {
  isDragging.value = false
}

const onPointerMove = (event) => {
  if (!isDragging.value || props.disabled || props.readOnly) return
  
  if (event.buttons === 1) {
    event.preventDefault()
    inputRef.value?.blur()
    const scale = event.shiftKey ? 10 : 1
    const delta = 
      Math.sign(event.movementX) * 
      Math.pow(Math.abs(event.movementX), 1.5) * 
      0.1 * 
      props.step * 
      scale
    scrubValue.value += delta
    const newValue = updateValue(scrubValue.value)
    internalValue.value = formatValue(newValue)
  }
}

const onButtonDown = (direction) => {
  if (props.disabled || props.readOnly) return
  
  isPressed.value = true
  const scale = event?.shiftKey ? 10 : 1
  const newValue = updateValue((props.modelValue ?? placeHolderValue.value ?? 0) + props.step * direction * scale)
  internalValue.value = formatValue(newValue)
  
  pressInterval.value = setInterval(() => {
    const scale = event?.shiftKey ? 10 : 1
    const newValue = updateValue((props.modelValue ?? placeHolderValue.value ?? 0) + props.step * direction * scale)
    internalValue.value = formatValue(newValue)
  }, 100)
}

const onButtonUp = () => {
  isPressed.value = false
  if (pressInterval.value) {
    clearInterval(pressInterval.value)
    pressInterval.value = null
  }
}
</script>

<style scoped>
.number-input-wrapper {
  display: inline-block;
  width: 100%;
}

.number-input-container {
  position: relative;
  display: flex;
  align-items: center;
  background-color: #2a2a2a;
  border-radius: 4px;
  overflow: hidden;
}

.number-input-input {
  flex: 1;
  border: none;
  outline: none;
  background: transparent;
  color: #ffffff;
  font-size: 14px;
  font-family: monospace;
  text-align: center;
  padding: 4px 8px;
  cursor: ew-resize;
  height: 30px;
  box-sizing: border-box;
}

.number-input-input:disabled,
.number-input-input:read-only {
  cursor: not-allowed;
  opacity: 0.6;
}

.number-input-button {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 24px;
  height: 30px;
  border: none;
  background: transparent;
  color: #888;
  cursor: pointer;
  opacity: 0;
  transition: opacity 0.15s ease;
  padding: 0;
}

.number-input-container:hover .number-input-button {
  opacity: 1;
}

.number-input-button:hover {
  background-color: var(--el-fill-color);
}

.number-input-button:disabled {
  cursor: not-allowed;
  opacity: 0.3 !important;
}

.number-input-button-left {
  border-radius: 4px 0 0 4px;
}

.number-input-button-right {
  border-radius: 0 4px 4px 0;
}

.number-input-input::-webkit-outer-spin-button,
.number-input-input::-webkit-inner-spin-button {
  -webkit-appearance: none;
  margin: 0;
}

.number-input-input[type=number] {
  -moz-appearance: textfield;
}
</style>
