import { InjectionKey, Ref, ref } from 'vue'
import { injection } from '@/util/inject'

export interface InstanceLauncherState {
  isOpen: Ref<boolean>
  open: () => void
  close: () => void
  toggle: () => void
}

export const kInstanceLauncher: InjectionKey<InstanceLauncherState> = Symbol('InstanceLauncher')

export function useInstanceLauncher(): InstanceLauncherState {
  const isOpen = ref(false)

  const open = () => {
    isOpen.value = true
  }

  const close = () => {
    isOpen.value = false
  }

  const toggle = () => {
    isOpen.value = !isOpen.value
  }

  return {
    isOpen,
    open,
    close,
    toggle,
  }
}

export function useInjectInstanceLauncher(): InstanceLauncherState {
  return injection(kInstanceLauncher)
}
