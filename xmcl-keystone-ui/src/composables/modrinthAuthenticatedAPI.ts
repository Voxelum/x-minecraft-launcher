
import { clientModrinthV2 } from '@/util/clients';
import { injection } from '@/util/inject';
import { useSingleton } from '@/util/singleton';
import { Collection, Project, User } from '@xmcl/modrinth';
import { UserServiceKey } from '@xmcl/runtime-api';
import { InjectionKey } from 'vue';
import { useDialog } from './dialog';
import { useService } from './service';

export const kModrinthAuthenticatedAPI: InjectionKey<ReturnType<typeof useModrinthAuthenticatedAPI>> = Symbol('modrinth-authenticated-api')

export function useModrinthAuthenticatedAPI() {
  const { loginModrinth, hasModrinthToken } = useService(UserServiceKey)
  const userData: Ref<User | undefined> = shallowRef(undefined)
  const collections: Ref<Collection[] | undefined> = shallowRef(undefined)
  const follows: Ref<Project[] | undefined> = shallowRef(undefined)
  const error: Ref<Error | undefined> = shallowRef(undefined)
  const isValidatingUser = shallowRef(false)
  const isValidatingFollows = shallowRef(false)
  const isValidatingCollections = shallowRef(false)
  const { show } = useDialog('modrinth-login')
  let signal = Promise.withResolvers<void>()

  onMounted(() => {
    hasModrinthToken().then((hasToken) => {
      if (hasToken) {
        login(true)
      }
    })
  })

  function acceptSignal() {
    signal.resolve()
    // Reset so the next awaitLogin round starts with a fresh pending promise.
    // Existing awaiters already captured the previous `.promise`, so this
    // reassignment is safe for them.
    signal = Promise.withResolvers<void>()
  }

  function rejectSignal() {
    signal.reject(new Error('Login cancelled'))
    signal = Promise.withResolvers<void>()
  }

  /**
   * Cancel an in-progress login attempt.
   *
   * Note: this cannot abort the underlying network request to Modrinth, but it
   * resets the in-flight signal and clears the validating flag so the UI can
   * return to the login prompt and the user can try again.
   */
  function cancelLogin() {
    rejectSignal()
    isValidatingUser.value = false
  }

  async function interact(options?: { silent?: boolean }) {
    try {
      await awaitLogin(options)
    } catch {
      // User cancelled or login failed; just bail. error.value will be set
      // and the UI's reactive guards (userData / isValidatingUser) handle it.
      return
    }
    if (!userData.value) {
      return
    }
    if (!follows.value) {
      mutateFollows()
    }
    if (!collections.value) {
      mutateCollections()
    }
  }

  // Dedupe concurrent login() calls. Without this an onMounted silent login
  // can race with a user-triggered explicit login and double-invoke OAuth.
  let loginInFlight: Promise<void> | undefined
  function login(silent = false): Promise<void> {
    if (loginInFlight) {
      return loginInFlight
    }
    loginInFlight = (async () => {
      isValidatingUser.value = true
      try {
        try {
          await loginModrinth()
        } catch (e) {
          if (silent) {
            // Silent mode is for the initial token check. Don't surface an
            // OAuth window — just record the error and bail.
            error.value = e as Error
            return
          }
          // Existing token (if any) is invalid. Force a fresh OAuth flow.
          await loginModrinth(true)
        }
        // Token is valid now — fetch the authenticated user.
        try {
          userData.value = await clientModrinthV2.getAuthenticatedUser()
        } catch (e) {
          // The token in our local cache appears valid (not expired by our
          // bookkeeping) but Modrinth rejected it (e.g. revoked, or stored
          // before we tracked `issued_at` and is actually expired). Force a
          // fresh OAuth and retry once. Skip in silent mode to avoid popping
          // the browser unexpectedly.
          if (silent || !isUnauthorizedLikeError(e)) {
            throw e
          }
          await loginModrinth(true)
          userData.value = await clientModrinthV2.getAuthenticatedUser()
        }
      } catch (e) {
        error.value = e as Error
      } finally {
        isValidatingUser.value = false
        loginInFlight = undefined
      }
    })()
    return loginInFlight
  }

  /**
   * Heuristic: detect responses from Modrinth that indicate the bearer token
   * is invalid/revoked/expired so we can force a fresh OAuth.
   *
   * The Modrinth API client throws `Error` whose message embeds the body and
   * status code from the failed response. Matching on text isn't ideal but
   * the client doesn't expose the status code on the thrown error.
   */
  function isUnauthorizedLikeError(e: unknown): boolean {
    if (!e) return false
    const message = (e as Error)?.message ?? String(e)
    if (typeof message !== 'string') return false
    return /\b401\b/.test(message) ||
      /unauthorized/i.test(message) ||
      /invalid authentication credentials/i.test(message)
  }

  async function mutateFollows() {
    if (userData.value?.id) {
      isValidatingFollows.value = true
      try {
        const id = userData.value.id
        follows.value = await clientModrinthV2.getUserFollowedProjects(id)
      } catch (e) {
        error.value = e as Error
      }
      isValidatingFollows.value = false
    }
  }
  async function mutateCollections() {
    if (userData.value?.id) {
      isValidatingCollections.value = true
      try {
        const id = userData.value.id
        collections.value = await clientModrinthV2.getCollections(id)
      } catch (e) {
        error.value = e as Error
        throw e
      } finally {
        isValidatingCollections.value = false
      }
    }
  }

  const followSet = computed(() => {
    if (follows.value) {
      return new Set(follows.value.map((follow) => follow.id))
    }
    return new Set<string>()
  })

  function isFollowed(id: string) {
    return followSet.value.has(id)
  }

  const awaitLogin = useSingleton(async (options?: { silent?: boolean }) => {
    if (userData.value) {
      return
    }
    if (!options?.silent) {
      show()
    }
    // Capture the current signal's promise once, before any reassignment.
    const promise = signal.promise
    await promise
    await login()
  })

  async function followProject(id: string) {
    await awaitLogin()

    if (!follows.value) {
      await mutateFollows()
    }
    await clientModrinthV2.followProject(id)
    await mutateFollows()
  }

  async function unfollowProject(id: string) {
    await awaitLogin()

    if (!follows.value) {
      await mutateFollows()
    }
    await clientModrinthV2.unfollowProject(id)
    await mutateFollows()
  }

  async function createCollection(name: string, description: string, projectIds: string[]) {
    await awaitLogin()

    if (!collections.value) {
      await mutateCollections()
    }
    await clientModrinthV2.createCollection(name, description, projectIds)
    await mutateCollections()
  }

  async function addToCollection(collectionId: string, projectId?: string) {
    await awaitLogin()

    if (!projectId) {
      return
    }
    if (!collections.value) {
      await mutateCollections()
    }
    const current = collections.value?.find((collection) => collection.id === collectionId)
    if (!current) {
      throw new TypeError('Collection not found')
    }
    await clientModrinthV2.updateCollection(collectionId, [...current.projects, projectId])
    await mutateCollections()
  }

  async function removeFromCollection(collectionId?: string, projectId?: string) {
    await awaitLogin()

    if (!projectId) {
      return
    }
    if (!collectionId) {
      return
    }
    if (!collections.value) {
      await mutateCollections()
    }
    const current = collections.value?.find((collection) => collection.id === collectionId)
    if (!current) {
      throw new TypeError('Collection not found')
    }
    await clientModrinthV2.updateCollection(collectionId, current.projects.filter((id) => id !== projectId))
    await mutateCollections()
  }

  async function deleteCollection(collectionId: string) {
    await awaitLogin()

    await clientModrinthV2.deleteCollection(collectionId)
    await mutateCollections()
  }

  return {
    interact,
    follows,
    rejectSignal,
    acceptSignal,
    cancelLogin,
    userData,
    userError: error,
    isValidatingUser,
    isValidatingFollows,
    followProject,
    unfollowProject,
    isFollowed,
    addToCollection,
    removeFromCollection,
    deleteCollection,
    collections,
    createCollection,
    isValidatingCollections,
  }

}

export function useModrinthFollow(projectId: Ref<string | undefined>) {
  const { followProject, isFollowed, unfollowProject, isValidatingUser, isValidatingFollows } = injection(kModrinthAuthenticatedAPI)
  const following = ref(false)
  const followingState = computed(() => following.value || isValidatingUser.value || isValidatingFollows.value)
  async function onFollow() {
    if (!projectId.value) {
      return
    }
    if (following.value) {
      return
    }
    following.value = true
    try {
      if (isFollowed(projectId.value)) {
        await unfollowProject(projectId.value)
      } else {
        await followProject(projectId.value)
      }
    } finally {
      following.value = false
    }
  }
  const isFollowedState = computed(() => {
    if (!projectId.value) {
      return false
    }
    return isFollowed(projectId.value)
  })
  return {
    onFollow,
    isFollowed: isFollowedState,
    following: followingState,
  }
}

export function useInCollection(projectId: Ref<string | undefined>) {
  const { collections, addToCollection, removeFromCollection, isValidatingCollections } = injection(kModrinthAuthenticatedAPI)
  const mutating = ref(false)
  const loadingCollections = computed(() => mutating.value || isValidatingCollections.value)

  const collectionId = computed(() => {
    const id = projectId.value
    if (!id) {
      return undefined
    }
    const collection = collections.value?.find((collection) => collection.projects.includes(id))
    return collection?.id
  })

  async function onAddOrRemove(id?: string) {
    const currentProjectId = projectId.value
    const currentCollectionId = collectionId.value
    if (!currentProjectId) {
      return
    }
    if (mutating.value) {
      return
    }
    mutating.value = true
    try {
      if (id) {
        await addToCollection(id, currentProjectId)
      } else {
        await removeFromCollection(currentCollectionId, currentProjectId)
      }
    } finally {
      mutating.value = false
    }
  }


  return {
    collectionId,
    loadingCollections,
    onAddOrRemove,
  }
}