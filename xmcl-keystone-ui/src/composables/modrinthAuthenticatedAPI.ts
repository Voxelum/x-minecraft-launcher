import { clientModrinthV2 } from '@/util/clients';
import { injection } from '@/util/inject';
import { useSingleton } from '@/util/singleton';
import { getSWRV } from '@/util/swrvGet';
import { Collection, Project, User } from '@xmcl/modrinth';
import { UserServiceKey } from '@xmcl/runtime-api';
import { InjectionKey } from 'vue';
import { useDialog } from './dialog';
import { useService } from './service';
import { kSWRVConfig } from './swrvConfig';

export const kModrinthAuthenticatedAPI: InjectionKey<ReturnType<typeof useModrinthAuthenticatedAPI>> = Symbol('modrinth-authenticated-api')

export function useModrinthAuthenticatedAPI() {
  const { loginModrinth, hasModrinthToken } = useService(UserServiceKey)
  const config = inject(kSWRVConfig)
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
  }

  function rejectSignal() {
    signal.reject(new Error('Login cancelled'))
    signal = Promise.withResolvers<void>()
  }

  async function interact() {
    await awaitLogin()
    if (!follows.value) {
      mutateFollows()
    }
    if (!collections.value) {
      mutateCollections()
    }
  }

  async function login(slient = false) {
    try {
      isValidatingUser.value = true
      await loginModrinth()
      userData.value = await clientModrinthV2.getAuthenticatedUser()
    } catch (e) {
      if (!slient) {
        await loginModrinth(true)
      }
      error.value = e as Error
    } finally {
      isValidatingUser.value = false
    }
  }

  async function mutateFollows() {
    if (userData.value?.id) {
      isValidatingFollows.value = true
      try {
        const id = userData.value.id
        follows.value = await getSWRV({
          key: '/modrinth-follows',
          fetcher: () => clientModrinthV2.getUserFollowedProjects(id)
        }, config)
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
        collections.value = await getSWRV({
          key: '/modrinth-collections',
          fetcher: () => clientModrinthV2.getCollections(id)
        }, config)
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

  const awaitLogin = useSingleton(async () => {
    if (userData.value) {
      return
    }
    show()
    await signal.promise
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

  return {
    interact,
    follows,
    rejectSignal,
    acceptSignal,
    userData,
    userError: error,
    isValidatingUser,
    isValidatingFollows,
    followProject,
    unfollowProject,
    isFollowed,
    addToCollection,
    removeFromCollection,
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
    if (!projectId.value) {
      return
    }
    if (mutating.value) {
      return
    }
    mutating.value = true
    try {
      if (id) {
        await addToCollection(id, projectId.value)
      } else {
        await removeFromCollection(collectionId.value, projectId.value)
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