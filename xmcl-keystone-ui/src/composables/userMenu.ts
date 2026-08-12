import { useEventBus } from '@vueuse/core'
import { ref, watch } from 'vue'

export type UserMenuRequest = 'overview' | 'login'

const shown = ref(false)

export function useUserMenuControl() {
  const bus = useEventBus<UserMenuRequest>('user-menu-control')

  return {
    on: bus.on,
    shown,
    show(mode: UserMenuRequest = 'overview') {
      shown.value = true
      bus.emit(mode)
    },
    showAndWait(mode: UserMenuRequest = 'overview') {
      shown.value = true
      bus.emit(mode)
      return new Promise<void>((resolve) => {
        const stop = watch(shown, (value) => {
          if (value) return
          stop()
          resolve()
        })
      })
    },
  }
}