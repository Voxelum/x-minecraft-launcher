import debounce from 'lodash.debounce'

const isShown = ref(false)
const stack = [] as SharedTooltipData[]
const blocked = ref(false)
const pending = [undefined as boolean | undefined]
const _setValue = debounce(() => {
  if (pending[0] === undefined) return
  isShown.value = pending[0]
  pending[0] = undefined
}, 100)
const setValue = (v: boolean) => {
  pending[0] = v
  _setValue()
}
const shouldPushStack = () => {
  return isShown.value && pending[0] === undefined
}

export interface SharedTooltipData {
  text: string
  direction: 'top' | 'bottom' | 'left' | 'right'
  x: number
  y: number
  color: string
}

const data = ref(undefined as SharedTooltipData | undefined)

export function useSharedTooltipData() {
  return {
    data,
    isShown,
    stack,
    setValue,
    shouldPushStack,
    blocked,
  }
}

export function useBlockSharedTooltip() {
  const start = () => {
    blocked.value = true
    isShown.value = false
    while (stack.length) {
      stack.pop()
    }
  }
  const end = () => {
    blocked.value = false
    isShown.value = false
    while (stack.length) {
      stack.pop()
    }
  }
  return {
    start,
    end,
  }
}
