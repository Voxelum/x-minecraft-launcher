import { computed, onMounted, onUnmounted, reactive, ref, watch } from '@vue/composition-api';
import { useI18n, useService } from '.';
import { InstanceOptionsServiceKey } from '../../shared/services/InstanceOptionsService';
import { useRefreshable } from './useRefreshable';
import { PersistedShaderPackResource } from '/@shared/entities/resource';
import { ResourceServiceKey } from '/@shared/services/ResourceService';

export interface ShaderPackItem {
  name: string
  value: string
  resource: PersistedShaderPackResource
  enabled: boolean
  tags: string[]
}

export function useShaderpacks() {
  const { state } = useService(ResourceServiceKey)
  const { state: options, editShaderOptions } = useService(InstanceOptionsServiceKey)
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
      enabled: 'OFF' === options.shaderoptions.shaderPack,
      tags: [],
    }, {
      name: $t('shaderpack.internal'),
      value: '(internal)',
      resource: null as any,
      enabled: '(internal)' === options.shaderoptions.shaderPack,
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
      tags: [...res.tags]
    }
  }
  const { refresh: commit, refreshing: committing } = useRefreshable(async () => {
    editShaderOptions({ shaderPack: selectedShaderPack.value })
  })

  watch(shaderPacksResources, (res) => {
    shaderPacks.value = getBuiltinItems().concat(res.map(getShaderPackItemFromResource))
  })

  onMounted(() => {
    shaderPacks.value = getBuiltinItems().concat(shaderPacksResources.value.map(getShaderPackItemFromResource))
    console.log(shaderPacks.value)
    console.log(selectedShaderPack.value)
  })

  onUnmounted(() => {
    commit()
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
  }
}
