import { InstanceOptionsServiceKey, InstanceShaderPacksServiceKey, Resource, ResourceServiceKey } from '@xmcl/runtime-api'
import { computed, onMounted, onUnmounted, ref, watch } from 'vue'

import { useRefreshable, useService } from '@/composables'
import { kShaderPacks, useShaderPacks } from './shaderPacks'
import { kInstanceContext } from './instanceContext'
import { injection } from '@/util/inject'

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
  const { options: { state: options }, path } = injection(kInstanceContext)
  const { resources: shaderPacksResources, refreshing: loading } = inject(kShaderPacks, () => useShaderPacks(), true)
  const { updateResources, removeResources } = useService(ResourceServiceKey)
  const { editShaderOptions } = useService(InstanceOptionsServiceKey)
  const { showDirectory } = useService(InstanceShaderPacksServiceKey)
  const { t } = useI18n()

  const shaderPacks = ref([] as ShaderPackItem[])
  const selectedShaderPack = ref(options.value?.shaderoptions.shaderPack)

  const isModified = computed(() => selectedShaderPack.value !== options.value?.shaderoptions.shaderPack)

  function getBuiltinItems(): ShaderPackItem[] {
    return [{
      name: t('shaderPack.off'),
      value: 'OFF',
      resource: null as any,
      enabled: options.value?.shaderoptions.shaderPack === 'OFF',
      description: t('shaderPack.offDescription'),
      path: '',
      tags: [],
    }, {
      name: t('shaderPack.internal'),
      value: '(internal)',
      resource: null as any,
      enabled: options.value?.shaderoptions.shaderPack === '(internal)',
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
      enabled: fileName === options.value?.shaderoptions.shaderPack,
      description: res.path,
      path: res.path,
      tags: [...res.tags],
      icon: res.icons?.[0],
    }
  }
  const { refresh: commit, refreshing: committing } = useRefreshable(async () => {
    editShaderOptions({ instancePath: path.value, shaderPack: selectedShaderPack.value || '' })
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

  function update(res: Resource[]) {
    const items = res.filter(r => !r.path.endsWith('.txt')).map(getShaderPackItemFromResource)
    shaderPacks.value = getBuiltinItems().concat(items)
  }

  watch(shaderPacksResources, (res) => {
    update(res)
  })

  onMounted(() => {
    update(shaderPacksResources.value)
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
