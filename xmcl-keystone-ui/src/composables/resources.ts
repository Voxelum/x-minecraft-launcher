import { Resource, ResourceDomain, ResourceServiceKey } from '@xmcl/runtime-api'
import { Ref } from 'vue'
import { useRefreshable } from './refreshable'
import { useService } from './service'

export function useResourceEffect(onResourceEffect: () => void, targetDomain?: ResourceDomain) {
  const { on, removeListener } = useService(ResourceServiceKey)
  const effect = ref(0)
  const onEffect = ({ domain }: { domain: ResourceDomain }) => {
    if (!targetDomain || domain === targetDomain) {
      effect.value += 1
    }
  }
  watch(effect, () => {
    onResourceEffect()
  })
  onMounted(() => {
    on('resourceAdd', onEffect)
    on('resourceRemove', onEffect)
    on('resourceUpdate', onEffect)
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

export function useResourceUrisDiscovery(uris: Ref<string[]>) {
  const { getResourcesByUris } = useService(ResourceServiceKey)

  const resources = shallowRef({} as Record<string, Resource>)
  const updateStatus = async () => {
    const allUris = uris.value
    const all = await getResourcesByUris(allUris)
    const result: Record<string, Resource> = {}
    for (let i = 0; i < all.length; i++) {
      const res = all[i]
      if (res) {
        result[allUris[i]] = res
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

export function useDomainResources(domain: ResourceDomain) {
  const { getResources, on, removeListener } = useService(ResourceServiceKey)

  const resources = ref([] as Resource[])

  const { refresh, refreshing } = useRefreshable(async () => {
    const all = await getResources(domain)
    all.forEach(markRaw)
    resources.value = all
  })

  onMounted(refresh)

  const onAdd = (r: Resource) => {
    if (domain !== r.domain) return
    resources.value = [r, ...resources.value]
  }
  const onRemove = (r: { sha1: string; domain: ResourceDomain }) => {
    if (domain !== r.domain) return
    resources.value = resources.value.filter(res => res.hash !== r.sha1)
  }
  const onUpdate = (r: Resource) => {
    if (domain !== r.domain) return
    const index = resources.value.findIndex(res => res.hash === r.hash)
    resources.value[index] = r
    resources.value = [...resources.value]
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
