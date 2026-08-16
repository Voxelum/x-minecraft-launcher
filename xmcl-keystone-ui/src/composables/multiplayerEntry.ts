import { kXmclAccount } from '@/composables/xmclAccount'
import { injection } from '@/util/inject'
import { watch, type InjectionKey, type Ref } from 'vue'
import { useDialog } from './dialog'

export const MultiplayerLoginDialogKey = 'multiplayer-login'

function useXmclAccountState() {
  return injection(kXmclAccount)
}

export interface MultiplayerEntryController {
  account: ReturnType<typeof useXmclAccountState>['account']
  busy: ReturnType<typeof useXmclAccountState>['busy']
  error: ReturnType<typeof useXmclAccountState>['error']
  isShown: Ref<boolean>
  request: () => void
  cancel: () => void
  handoff: (action: () => Promise<void>) => Promise<void>
  authorizeProvider: ReturnType<typeof useXmclAccountState>['authorizeProvider']
}

export const kMultiplayerEntry: InjectionKey<MultiplayerEntryController> =
  Symbol('MultiplayerEntry')

export function createMultiplayerEntryController<T>(
  account: Ref<T | undefined>,
  isShown: Ref<boolean>,
  showDialog: () => void,
  hideDialog: () => void,
  openWindow: () => void,
) {
  let waitingForLogin = false
  let handingOff = false

  const stopShownWatch = watch(isShown, (shown, wasShown) => {
    if (wasShown && !shown && waitingForLogin && !handingOff) {
      waitingForLogin = false
    }
  })
  const stopAccountWatch = watch(account, (value) => {
    if (!value || !waitingForLogin) return
    waitingForLogin = false
    hideDialog()
    openWindow()
  })

  function request() {
    if (account.value) {
      openWindow()
      return
    }
    waitingForLogin = true
    showDialog()
  }

  function cancel() {
    waitingForLogin = false
    hideDialog()
  }

  async function handoff(action: () => Promise<void>) {
    handingOff = true
    hideDialog()
    try {
      await action()
    } finally {
      handingOff = false
      if (waitingForLogin && !account.value) showDialog()
    }
  }

  return {
    request,
    cancel,
    handoff,
    dispose() {
      stopShownWatch()
      stopAccountWatch()
    },
  }
}

export function useMultiplayerEntry(): MultiplayerEntryController {
  const xmclAccount = useXmclAccountState()
  const { isShown, show, hide } = useDialog(MultiplayerLoginDialogKey)
  const controller = createMultiplayerEntryController(
    xmclAccount.account,
    isShown,
    show,
    hide,
    () => windowController.openMultiplayerWindow(),
  )

  return {
    account: xmclAccount.account,
    busy: xmclAccount.busy,
    error: xmclAccount.error,
    isShown,
    authorizeProvider: xmclAccount.authorizeProvider,
    request: controller.request,
    cancel: controller.cancel,
    handoff: controller.handoff,
  }
}