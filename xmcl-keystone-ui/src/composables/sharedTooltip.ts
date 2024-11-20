import debounce from 'lodash.debounce'

const isShown = ref(false)
const stack = ref([] as SharedTooltipData[])
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

export interface SharedTooltipData {
  text: string
  direction: 'top' | 'bottom' | 'left' | 'right'
  x: number
  y: number
  color: string
  items: Array<{ text: string; icon: string }> | undefined
  list: Array<string> | undefined
}

export function useSharedTooltipData() {
  return {
    isShown,
    stack,
    setValue,
    blocked,
  }
}

export function useBlockSharedTooltip() {
  const start = () => {
    blocked.value = true
    isShown.value = false
    stack.value = []
  }
  const end = () => {
    blocked.value = false
    isShown.value = false
    stack.value = []
  }
  return {
    start,
    end,
  }
}
