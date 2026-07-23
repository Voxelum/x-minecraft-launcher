import {
  AUTHORITY_MICROSOFT,
  CommercialAccountServiceKey,
  CommercialAccountState,
  type CommercialOAuthProvider,
  type UserProfile,
} from '@xmcl/runtime-api'
import type { InjectionKey, Ref } from 'vue'
import { useService } from './service'
import { useState } from './syncableState'

export const kCommercialAccount: InjectionKey<ReturnType<typeof useCommercialAccount>> = Symbol('CommercialAccount')

export function useCommercialAccount(
  selectedGameAccount: Ref<UserProfile>,
  modrinthUserId: Ref<string | undefined>,
) {
  const service = useService(CommercialAccountServiceKey)
  const { state, isValidating, error: stateError } = useState(
    service.getCommercialAccountState,
    class extends CommercialAccountState {
      override snapshot(snapshot: Parameters<CommercialAccountState['snapshot']>[0]) {
        super.snapshot(snapshot)
      }

      override identityConflict(conflict: Parameters<CommercialAccountState['identityConflict']>[0]) {
        super.identityConflict(conflict)
      }

      override operationError(error: Parameters<CommercialAccountState['operationError']>[0]) {
        super.operationError(error)
      }

      override mergePrepared(preview: Parameters<CommercialAccountState['mergePrepared']>[0]) {
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

  watch(
    () => [
      selectedGameAccount.value.id,
      selectedGameAccount.value.authority,
      selectedGameAccount.value.invalidated,
      selectedGameAccount.value.expiredAt,
    ] as const,
    ([id, authority, invalidated, expiresAt]) => {
      if (id && authority === AUTHORITY_MICROSOFT && !invalidated && expiresAt > Date.now()) {
        run(() => service.bootstrapMicrosoft(id))
      }
    },
    { immediate: true },
  )

  watch(modrinthUserId, (id) => {
    if (id) run(service.bootstrapModrinth)
  }, { immediate: true })

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
    authorizeProvider: (provider: Extract<CommercialOAuthProvider, 'google' | 'discord'>) => run(() => service.authorizeProvider(provider)),
    prepareMerge: () => run(service.prepareMerge),
    confirmMerge: () => run(service.confirmMerge),
    refreshAccount: () => run(service.refreshAccount),
    refreshSession: () => run(service.refreshSession),
    revokeSession: (allDevices = false) => run(() => service.revokeSession(allDevices)),
    unlinkIdentity: (provider: CommercialOAuthProvider) => run(() => service.unlinkIdentity(provider)),
    requestDeletion: () => run(service.requestDeletion),
    cancelDeletion: () => run(service.cancelDeletion),
  }
}
