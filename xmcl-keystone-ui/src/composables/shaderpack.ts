import { computed, onMounted, onUnmounted, ref, watch } from 'vue'
import { InstanceOptionsServiceKey, Persisted, ShaderPackResource, InstanceShaderPacksServiceKey, ResourceServiceKey, ResourceDomain } from '@xmcl/runtime-api'

import { useServiceBusy, useService, useRefreshable } from '@/composables'

export interface ShaderPackItem {
  name: string
  value: string
  resource: Persisted<ShaderPackResource>
  enabled: boolean
  description: string
  path: string
  tags: string[]
}

export function useShaderpacks() {
  const { state, updateResources, removeResource } = useService(ResourceServiceKey)
  const { state: options, editShaderOptions } = useService(InstanceOptionsServiceKey)
  const { showDirectory } = useService(InstanceShaderPacksServiceKey)
  const loading = useServiceBusy(ResourceServiceKey, 'load', ResourceDomain.ShaderPacks)
  const { t } = useI18n()

  const shaderPacks = ref([] as ShaderPackItem[])
  const shaderPacksResources = computed(() => state.shaderpacks)
  const selectedShaderPack = ref(options.shaderoptions.shaderPack)

  const isModified = computed(() => selectedShaderPack.value !== options.shaderoptions.shaderPack)

  function getBuiltinItems(): ShaderPackItem[] {
    return [{
      name: t('shaderPack.off'),
      value: 'OFF',
      resource: null as any,
      enabled: options.shaderoptions.shaderPack === 'OFF',
      description: t('shaderPack.offDescription'),
      path: '',
      tags: [],
    }, {
      name: t('shaderPack.internal'),
      value: '(internal)',
      resource: null as any,
      enabled: options.shaderoptions.shaderPack === '(internal)',
      description: t('shaderPack.internalDescription'),
      path: '',
      tags: [],
    }]
  }
  function getShaderPackItemFromResource(res: Persisted<ShaderPackResource>): ShaderPackItem {
    const fileName = res.fileName
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
    updateResources(shaderPacks.value.map(pack => ({
      tags: pack.tags,
      name: pack.name,
      hash: pack.resource.hash,
    })))
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
