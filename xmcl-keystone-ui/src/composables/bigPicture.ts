import { createGlobalState, useLocalStorage } from '@vueuse/core'
import { inject, type InjectionKey, ref, watch } from 'vue'
import { useGamepad } from './gamepad'
import { BaseServiceKey } from '@xmcl/runtime-api'
import { useService } from './service'

export const useBigPicture = createGlobalState(() => {
  const isBigPicture = ref(false)
  const defaultLaunch = useLocalStorage('big_picture_default_launch', false)
  const autoOnGamepad = useLocalStorage('big_picture_auto_gamepad', false)
  const userExitedInSession = ref(false)

  const gamepad = useGamepad()
  const isConsoleOrDeck = ref(false)

  // Detect Steam Deck, Gamescope, or handheld console environment
  const { getEnvironment } = useService(BaseServiceKey)
  getEnvironment().then((env) => {
    if (env?.steamDeck) {
      isConsoleOrDeck.value = true
      if (!userExitedInSession.value && !isBigPicture.value) {
        enterBigPicture()
      }
    }
  }).catch(() => {})

  // Only auto-launch in Big Picture mode if:
  // 1. Running on Steam Deck / handheld console environment, OR
  // 2. A real physical gamepad is connected AND (autoOnGamepad OR defaultLaunch is enabled)
  // When launched on PC without a gamepad or console: ALWAYS start in desktop mode.
  watch(
    [() => gamepad.connected.value, isConsoleOrDeck],
    ([connected, isConsole]) => {
      if (userExitedInSession.value) return

      if (isConsole) {
        if (!isBigPicture.value) {
          enterBigPicture()
        }
      } else if (connected) {
        if ((autoOnGamepad.value || defaultLaunch.value) && !isBigPicture.value) {
          enterBigPicture()
        }
      }
    },
    { immediate: true },
  )

  function enterBigPicture() {
    userExitedInSession.value = false
    isBigPicture.value = true
    try {
      if (typeof document !== 'undefined' && document.documentElement && !document.fullscreenElement) {
        document.documentElement.requestFullscreen().catch(() => {})
      }
    } catch {}
  }

  function exitBigPicture() {
    userExitedInSession.value = true
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
