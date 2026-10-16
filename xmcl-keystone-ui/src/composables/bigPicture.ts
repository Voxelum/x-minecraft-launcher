import { createGlobalState, useLocalStorage } from '@vueuse/core'
import { inject, type InjectionKey, ref, watch } from 'vue'
import { useGamepad } from './gamepad'

export const useBigPicture = createGlobalState(() => {
  const isBigPicture = ref(false)
  const defaultLaunch = useLocalStorage('big_picture_default_launch', false)
  const autoOnGamepad = useLocalStorage('big_picture_auto_gamepad', false)

  if (defaultLaunch.value) {
    isBigPicture.value = true
  }

  const gamepad = useGamepad()

  // Auto switch when a controller connects if user enabled that setting
  watch(
    () => gamepad.connected.value,
    (connected) => {
      if (connected && autoOnGamepad.value && !isBigPicture.value) {
        enterBigPicture()
      }
    },
  )

  function enterBigPicture() {
    isBigPicture.value = true
    try {
      if (typeof document !== 'undefined' && document.documentElement && !document.fullscreenElement) {
        document.documentElement.requestFullscreen().catch(() => {})
      }
    } catch {}
  }

  function exitBigPicture() {
    isBigPicture.value = false
    try {
      if (typeof document !== 'undefined' && document.fullscreenElement) {
        document.exitFullscreen().catch(() => {})
      }
    } catch {}
  }

  function toggleBigPicture() {
    if (isBigPicture.value) {
      exitBigPicture()
    } else {
      enterBigPicture()
    }
  }

  const virtualKeyboardHandler = ref<((preferSteam?: boolean) => Promise<boolean>) | null>(null)

  function registerVirtualKeyboardHandler(handler: (preferSteam?: boolean) => Promise<boolean>) {
    virtualKeyboardHandler.value = handler
  }

  async function openVirtualKeyboard(preferSteam?: boolean) {
    if (virtualKeyboardHandler.value) {
      return virtualKeyboardHandler.value(preferSteam)
    }
    return false
  }

  return {
    isBigPicture,
    defaultLaunch,
    autoOnGamepad,
    enterBigPicture,
    exitBigPicture,
    toggleBigPicture,
    registerVirtualKeyboardHandler,
    openVirtualKeyboard,
  }
})

export type UseBigPictureReturn = ReturnType<typeof useBigPicture>
export const kBigPicture: InjectionKey<UseBigPictureReturn> = Symbol('BigPicture')
