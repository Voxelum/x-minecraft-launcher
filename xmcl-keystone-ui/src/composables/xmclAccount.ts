import {
  XmclAccountServiceKey,
  XmclAccountState,
  type XmclOAuthProvider,
} from '@xmcl/runtime-api'
import type { InjectionKey } from 'vue'
import { useService } from './service'
import { useState } from './syncableState'

export const kXmclAccount: InjectionKey<ReturnType<typeof useXmclAccount>> = Symbol('XmclAccount')

export function useXmclAccount() {
  const service = useService(XmclAccountServiceKey)
  const {
    state,
    isValidating,
    error: stateError,
  } = useState(
    service.getXmclAccountState,
    class extends XmclAccountState {
      override snapshot(snapshot: Parameters<XmclAccountState['snapshot']>[0]) {
        super.snapshot(snapshot)
      }

      override identityConflict(conflict: Parameters<XmclAccountState['identityConflict']>[0]) {
        super.identityConflict(conflict)
      }

      override operationError(error: Parameters<XmclAccountState['operationError']>[0]) {
        super.operationError(error)
      }

      override mergePrepared(preview: Parameters<XmclAccountState['mergePrepared']>[0]) {
        super.mergePrepared(preview)
      }

      override mergeQueued(taskId: string) {
        super.mergeQueued(taskId)
      }

      override clearError() {
        super.clearError()
      }

      override guest() {
        super.guest()
      }
    },
  )
  const actionError = shallowRef<Error>()
  const busy = shallowRef(false)

  async function run(action: () => Promise<void>) {
    if (busy.value) return
    busy.value = true
    actionError.value = undefined
    try {
      await action()
    } catch (error) {
      actionError.value = error as Error
    } finally {
      busy.value = false
    }
  }

  const account = computed(() => state.value?.account)
  const identities = computed(() => state.value?.identities ?? [])
  const session = computed(() => state.value?.session)
  const conflict = computed(() => state.value?.conflict)
  const mergePreview = computed(() => state.value?.mergePreview)
  const mergeTaskId = computed(() => state.value?.mergeTaskId)
  const sessionExpired = computed(() => {
    const expiresAt = session.value?.expiresAt
    return !!expiresAt && Date.parse(expiresAt) <= Date.now()
  })

  return {
    account,
    identities,
    session,
    conflict,
    mergePreview,
    mergeTaskId,
    sessionExpired,
    busy,
    isValidating,
    error: computed(() => actionError.value ?? state.value?.error ?? stateError.value),
    authorizeMicrosoft: () => run(service.authorizeMicrosoft),
    authorizeModrinth: () => run(service.authorizeModrinth),
    authorizeProvider: (provider: Extract<XmclOAuthProvider, 'google' | 'discord'>) =>
      run(() => service.authorizeProvider(provider)),
    prepareMerge: () => run(service.prepareMerge),
    confirmMerge: () => run(service.confirmMerge),
    refreshAccount: () => run(service.refreshAccount),
    refreshSession: () => run(service.refreshSession),
    revokeSession: (allDevices = false) => run(() => service.revokeSession(allDevices)),
  }
}
