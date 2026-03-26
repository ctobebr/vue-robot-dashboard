<template>
  <div class="ip-input-box">
    <input
      ref="ip1Ref"
      id="ip1"
      type="text"
      class="ip-input-input"
      :value="ipAddress[0]"
      :disabled="disabled"
      autocomplete="off"
      @input="handleInput($event, 0)"
      @keydown="handleKeyDown($event, 0)"
    />
    <span class="ip-input-dot">.</span>
    <input
      ref="ip2Ref"
      id="ip2"
      type="text"
      class="ip-input-input"
      :value="ipAddress[1]"
      :disabled="disabled"
      autocomplete="off"
      @input="handleInput($event, 1)"
      @keydown="handleKeyDown($event, 1)"
    />
    <span class="ip-input-dot">.</span>
    <input
      ref="ip3Ref"
      id="ip3"
      type="text"
      class="ip-input-input"
      :value="ipAddress[2]"
      :disabled="disabled"
      autocomplete="off"
      @input="handleInput($event, 2)"
      @keydown="handleKeyDown($event, 2)"
    />
    <span class="ip-input-dot">.</span>
    <input
      ref="ip4Ref"
      id="ip4"
      type="text"
      class="ip-input-input"
      :value="ipAddress[3]"
      :disabled="disabled"
      autocomplete="off"
      @input="handleInput($event, 3)"
      @keydown="handleKeyDown($event, 3)"
    />
  </div>
</template>

<script setup>
import { ref, watch, nextTick } from 'vue'

const props = defineProps({
  modelValue: {
    type: String,
    default: '0.0.0.0'
  },
  disabled: {
    type: Boolean,
    default: false
  }
})

const emit = defineEmits(['update:modelValue'])

const ip1Ref = ref(null)
const ip2Ref = ref(null)
const ip3Ref = ref(null)
const ip4Ref = ref(null)

const ipAddress = ref(props.modelValue.split('.'))

watch(() => props.modelValue, (newValue) => {
  ipAddress.value = newValue.split('.')
})

const focusNext = (index) => {
  nextTick(() => {
    switch (index) {
      case 0:
        ip2Ref.value?.focus()
        break
      case 1:
        ip3Ref.value?.focus()
        break
      case 2:
        ip4Ref.value?.focus()
        break
      default:
        break
    }
  })
}

const focusPrev = (index) => {
  nextTick(() => {
    switch (index) {
      case 1:
        ip1Ref.value?.focus()
        break
      case 2:
        ip2Ref.value?.focus()
        break
      case 3:
        ip3Ref.value?.focus()
        break
      default:
        break
    }
  })
}

const handleInput = (event, index) => {
  if (props.disabled) return
  
  let value = event.target.value
  
  if (value.includes('.')) {
    return
  }
  
  let newValue = parseInt(value, 10)
  
  if (isNaN(newValue)) {
    newValue = 0
  }
  
  newValue = Math.max(0, Math.min(255, newValue))
  
  const newIpAddress = [...ipAddress.value]
  newIpAddress[index] = newValue.toString()
  ipAddress.value = newIpAddress
  
  if (newValue.toString().length === 3 && index < 3) {
    focusNext(index)
  }
  
  const ip = newIpAddress.join('.')
  emit('update:modelValue', ip)
}

const handleKeyDown = (event, index) => {
  if (props.disabled) return
  
  if (event.key === ' ') {
    event.preventDefault()
    if (index < 3) {
      focusNext(index)
    }
  }
  
  if (event.key === 'Backspace') {
    const currentValue = event.currentTarget.value
    if (currentValue === '' || parseInt(currentValue) === 0) {
      if (index > 0) {
        focusPrev(index)
      }
    }
  }
  
  if (event.key === 'ArrowRight' && index < 3) {
    event.preventDefault()
    focusNext(index)
  }
  
  if (event.key === 'ArrowLeft' && index > 0) {
    event.preventDefault()
    focusPrev(index)
  }
}
</script>

<style scoped>
.ip-input-box {
  display: flex;
  align-items: center;
  border: 1px solid #424242;
  background-color: #2e2e2e;
  border-radius: 4px;
  padding: 0 4px;
  height: 28px;
}

.ip-input-input {
  flex: 1;
  border: none;
  outline: none;
  background: transparent;
  color: var(--el-text-color-primary);
  font-size: 12px;
  text-align: center;
  width: 100%;
  min-width: 0;
  padding: 0;
}

.ip-input-input:disabled {
  opacity: 0.6;
  cursor: not-allowed;
}

.ip-input-dot {
  color: var(--el-text-color-primary);
  font-size: 12px;
  margin: 0 2px;
}

.ip-input-input::-webkit-outer-spin-button,
.ip-input-input::-webkit-inner-spin-button {
  -webkit-appearance: none;
  margin: 0;
}

.ip-input-input[type=number] {
  -moz-appearance: textfield;
}
</style>
