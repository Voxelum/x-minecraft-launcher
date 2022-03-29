import { computed, onMounted, onUnmounted, ref, watch } from '@vue/composition-api'
import { useBusy, useI18n, useService } from '.'
import { InstanceOptionsServiceKey, PersistedShaderPackResource, InstanceShaderPacksServiceKey, ResourceServiceKey } from '@xmcl/runtime-api'
import { useRefreshable } from './useRefreshable'

export interface ShaderPackItem {
  name: string
  value: string
  resource: PersistedShaderPackResource
  enabled: boolean
  description: string
  path: string
  tags: string[]
}

export function useShaderpacks() {
  const { state, updateResource, removeResource } = useService(ResourceServiceKey)
  const { state: options, editShaderOptions } = useService(InstanceOptionsServiceKey)
  const { showDirectory } = useService(InstanceShaderPacksServiceKey)
  const loading = useBusy('loadDomain(shaderpacks:resource)')
  const { $t } = useI18n()

  const shaderPacks = ref([] as ShaderPackItem[])
  const shaderPacksResources = computed(() => state.shaderpacks)
  const selectedShaderPack = ref(options.shaderoptions.shaderPack)

  const isModified = computed(() => selectedShaderPack.value !== options.shaderoptions.shaderPack)

  function getBuiltinItems(): ShaderPackItem[] {
    return [{
      name: $t('shaderpack.off'),
      value: 'OFF',
      resource: null as any,
      enabled: options.shaderoptions.shaderPack === 'OFF',
      description: $t('shaderpack.offDescription'),
      path: '',
      tags: [],
    }, {
      name: $t('shaderpack.internal'),
      value: '(internal)',
      resource: null as any,
      enabled: options.shaderoptions.shaderPack === '(internal)',
      description: $t('shaderpack.internalDescription'),
      path: '',
      tags: [],
    }]
  }
  function getShaderPackItemFromResource(res: PersistedShaderPackResource): ShaderPackItem {
    const fileName = `${res.fileName}${res.ext}`
    return {
      name: res.name,
      value: fileName,
      resource: res,
      enabled: fileName === options.shaderoptions.shaderPack,
      description: res.path,
      path: res.path,
      tags: [...res.tags],
    }
  }
  const { refresh: commit, refreshing: committing } = useRefreshable(async () => {
    editShaderOptions({ shaderPack: selectedShaderPack.value })
  })

  function updateResourceTags() {
    for (const pack of shaderPacks.value) {
      if (pack.resource) {
        const updated = { tags: undefined as undefined | string[], name: undefined as undefined | string }
        if (pack.tags.length !== pack.resource.tags.length || pack.tags.some((t, i) => t !== pack.resource.tags[i])) {
          updated.tags = pack.tags
        }
        if (pack.name) {
          updated.name = pack.name
        }
        if (updated.name || updated.tags) {
          updateResource({ resource: pack.resource, ...updated })
        }
      }
    }
  }

  async function removeShaderPack(item: ShaderPackItem) {
    if (!item.enabled && item.path) {
      await removeResource(item.resource)
    }
  }

  watch(shaderPacksResources, (res) => {
    shaderPacks.value = getBuiltinItems().concat(res.map(getShaderPackItemFromResource))
  })

  onMounted(() => {
    shaderPacks.value = getBuiltinItems().concat(shaderPacksResources.value.map(getShaderPackItemFromResource))
  })

  onUnmounted(() => {
    commit()
    updateResourceTags()
  })

  watch(selectedShaderPack, (pack) => {
    for (const p of shaderPacks.value) {
      p.enabled = p.value === pack
    }
  })

  return {
    shaderPacks,
    isModified,
    selectedShaderPack,
    commit,
    committing,
    removeShaderPack,
    showDirectory,
    loading,
  }
}
