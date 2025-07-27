import { injection } from '@/util/inject'
import { InjectionKey } from 'vue'

export const kDropHandler: InjectionKey<ReturnType<typeof useDropHandler>> = Symbol('DropHandle')

export interface DropHandler {
  onEnter?: () => void
  onDrop?: (data: DataTransfer) => Promise<void>
  onLeave?: () => void
}

export function useGlobalDrop(handler: DropHandler) {
  const { registerHandler, dragover } = injection(kDropHandler)
  let dispose = () => { }
  onMounted(() => {
    dispose = registerHandler(handler)
  })
  onUnmounted(() => dispose())
  return { dragover }
}

export function useDropHandler() {
  const dragover = ref(false)
  const handlers: Array<DropHandler> = []

  function registerHandler(handler: DropHandler) {
    handlers.unshift(handler)
    return () => {
      const index = handlers.indexOf(handler)
      if (index >= 0) {
        handlers.splice(index, 1)
      }
    }
  }

  async function onDrop(event: DragEvent) {
    const dataTransfer = event.dataTransfer!
    if (dataTransfer) {
      handlers[0]?.onDrop?.(dataTransfer)
    }
  }

  document.addEventListener('dragleave', (e) => {
    if ((e as any).fromElement === null && e.dataTransfer!.effectAllowed === 'all') {
      handlers[0]?.onLeave?.()
      dragover.value = false
    }
  })
  document.addEventListener('drop', (e) => {
    dragover.value = false
    if (e.defaultPrevented) return
    onDrop(e)
    e.preventDefault()
  })
  document.addEventListener('dragover', (e) => {
    if ((e as any).fromElement === null) {
      if (e.dataTransfer!.effectAllowed === 'all') {
        e.preventDefault()
      }
    }
  })
  document.addEventListener('dragenter', (e) => {
    if ((e as any).fromElement === null) {
      if (e.dataTransfer!.effectAllowed === 'all') {
        handlers[0]?.onEnter?.()
        dragover.value = true
      }
    }
    e.dataTransfer!.dropEffect = 'copy'
  })

  return {
    dragover,
    registerHandler,
  }
}
