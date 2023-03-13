import { InstanceOptionsServiceKey, InstanceShaderPacksServiceKey, Resource, ResourceServiceKey } from '@xmcl/runtime-api'
import { computed, onMounted, onUnmounted, ref, watch } from 'vue'

import { useRefreshable, useService } from '@/composables'
import { kShaderPacks, useShaderPacks } from './shaderPacks'

export interface ShaderPackItem {
  name: string
  value: string
  resource: Resource
  enabled: boolean
  description: string
  path: string
  tags: string[]
  icon?: string
}

export function useShaderpacks() {
  const { resources: shaderPacksResources, refreshing: loading } = inject(kShaderPacks, () => useShaderPacks(), true)
  const { updateResources, removeResources } = useService(ResourceServiceKey)
  const { state: options, editShaderOptions } = useService(InstanceOptionsServiceKey)
  const { showDirectory } = useService(InstanceShaderPacksServiceKey)
  const { t } = useI18n()

  const shaderPacks = ref([] as ShaderPackItem[])
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
  function getShaderPackItemFromResource(res: Resource): ShaderPackItem {
    const fileName = res.fileName
    return {
      name: res.name,
      value: fileName,
      resource: res,
      enabled: fileName === options.shaderoptions.shaderPack,
      description: res.path,
      path: res.path,
      tags: [...res.tags],
      icon: res.icons?.[0],
    }
  }
  const { refresh: commit, refreshing: committing } = useRefreshable(async () => {
    editShaderOptions({ shaderPack: selectedShaderPack.value })
  })

  function updateResourceTags() {
    updateResources(shaderPacks.value.filter(pack => !!pack.resource).map(pack => ({
      tags: pack.tags,
      name: pack.name,
      hash: pack.resource.hash,
    })))
  }

  async function removeShaderPack(item: ShaderPackItem) {
    if (!item.enabled && item.path) {
      await removeResources([item.resource.hash])
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
