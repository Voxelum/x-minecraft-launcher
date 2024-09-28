import { PartialResourceHash, Resource, ResourceDomain, ResourceServiceKey, applyUpdateToResource } from '@xmcl/runtime-api'
import { Ref } from 'vue'
import { useRefreshable } from './refreshable'
import { useService } from './service'

export function useResourceAdd(onResourceEffect: (res: Resource) => void, targetDomain?: ResourceDomain) {
  const { on, removeListener } = useService(ResourceServiceKey)
  const onEffect = (res: Resource) => {
    if (!targetDomain || res.domain === targetDomain) {
      onResourceEffect(res)
    }
  }
  onMounted(() => {
    on('resourceAdd', onEffect)
  })
  onUnmounted(() => {
    removeListener('resourceAdd', onEffect)
  })
}

export function useResourceEffect(onResourceEffect: () => void, targetDomain?: ResourceDomain) {
  const { on, removeListener } = useService(ResourceServiceKey)
  const effect = ref(0)
  const onEffect = ({ domain }: { domain?: ResourceDomain }) => {
    if (!domain) {
      effect.value += 1
    } else if (!targetDomain || domain === targetDomain) {
      effect.value += 1
    }
  }
  watch(effect, () => {
    onResourceEffect()
  })
  onMounted(() => {
    on('resourceAdd', onEffect)
    on('resourceRemove', onEffect)
    on('resourceUpdate', onEffect as any)
  })
  onUnmounted(() => {
    removeListener('resourceAdd', onEffect)
    removeListener('resourceRemove', onEffect)
    removeListener('resourceUpdate', onEffect)
  })
}

export function useResourceSha1Discovery(sha1: Ref<string[]>) {
  const { getResourcesByHashes } = useService(ResourceServiceKey)

  const resources = shallowRef({} as Record<string, Resource>)
  const updateStatus = async () => {
    const hashes = sha1.value
    const all = await getResourcesByHashes(hashes)
    const result: Record<string, Resource> = {}
    for (let i = 0; i < all.length; i++) {
      const res = all[i]
      if (res) {
        result[hashes[i]] = res
      }
    }
    resources.value = result
  }

  onMounted(updateStatus)
  useResourceEffect(updateStatus)
  watch(sha1, updateStatus)

  return {
    resources,
  }
}

export function useResourceUriStartsWithDiscovery(startsWith: Ref<string>) {
  const { getResourcesByStartsWithUri } = useService(ResourceServiceKey)

  const resources = shallowRef({} as Record<string, Resource | undefined>)
  const updateStatus = async () => {
    const all = await getResourcesByStartsWithUri(startsWith.value)
    const result: Record<string, Resource> = {}
    for (const r of all) {
      for (const u of r.uris) {
        result[u] = r
      }
    }
    resources.value = result
  }

  onMounted(updateStatus)
  useResourceEffect(updateStatus)
  watch(startsWith, updateStatus)

  return {
    resources,
  }
}

export function useResourceUrisDiscovery(uris: Ref<string[]>) {
  const { getResourcesByUris } = useService(ResourceServiceKey)

  const resources = shallowRef({} as Record<string, Resource | undefined>)
  const updateStatus = async () => {
    const allUris = uris.value
    const all = await getResourcesByUris(allUris)
    const result: Record<string, Resource> = {}
    for (const r of all) {
      for (const u of r.uris) {
        result[u] = r
      }
    }
    resources.value = result
  }

  onMounted(updateStatus)
  useResourceEffect(updateStatus)
  watch(uris, updateStatus)

  return {
    resources,
  }
}

export function useDomainResources(domain: ResourceDomain | Ref<ResourceDomain>) {
  const { getResources, on, removeListener } = useService(ResourceServiceKey)

  const resources = ref([] as Resource[])

  const { refresh, refreshing } = useRefreshable(async () => {
    const all = await getResources(typeof domain === 'object' ? domain.value : domain)
    all.forEach(markRaw)
    resources.value = all
  })

  onMounted(refresh)
  if (typeof domain === 'object') {
    watch(domain, () => refresh())
  }

  const onAdd = (r: Resource) => {
    if (typeof domain === 'object' ? domain.value : domain !== r.domain) return
    const index = resources.value.findIndex(res => res.hash === r.hash)
    if (index !== -1) {
      resources.value[index] = r
    } else {
      resources.value = [r, ...resources.value]
    }
  }
  const onRemove = (r: { sha1: string; domain: ResourceDomain }) => {
    if (typeof domain === 'object' ? domain.value : domain !== r.domain) return
    resources.value = resources.value.filter(res => res.hash !== r.sha1)
  }
  const onUpdate = (update: PartialResourceHash[]) => {
    for (const u of update) {
      const index = resources.value.findIndex(res => res.hash === u.hash)
      if (index !== -1) {
        const resource = resources.value[index]
        applyUpdateToResource(resource, u)
      }
    }
  }

  onMounted(() => {
    on('resourceAdd', onAdd)
    on('resourceRemove', onRemove)
    on('resourceUpdate', onUpdate)
  })
  onUnmounted(() => {
    removeListener('resourceAdd', onAdd)
    removeListener('resourceRemove', onRemove)
    removeListener('resourceUpdate', onUpdate)
  })

  return {
    resources,
    refresh,
    refreshing,
  }
}
