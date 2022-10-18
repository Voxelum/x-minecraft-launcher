import { computed, Ref, ref, watch } from 'vue'
import { BlockStateJson, ResourcePackPreviewServiceKey } from '@xmcl/runtime-api'
import { useService } from '@/composables'

export function useBlockModelPreview () {
  const { getBlockStates: listBlockStates, loadModel } = useService(ResourcePackPreviewServiceKey)
  return {
    listBlockStates,
    loadModel,
  }
}

export function useBlockStateModels (blockState: Ref<BlockStateJson | undefined>) {
  watch(blockState, () => {
    const variants: { name: string; value: string; items: string[] }[] = []
    if (!blockState.value || !blockState.value.variants) return
    for (const key of Object.keys(blockState.value.variants)) {
      if (key === '') { continue }
      key.split(',').map((k) => k.split('=')).forEach(([varIn, value]) => {
        const found = variants.find((v) => v.name === varIn)
        if (found) {
          if (found.items.indexOf(value) === -1) {
            found.items.push(value)
          }
        } else {
          variants.push({ items: [value], value, name: varIn })
        }
      })
    }
    selects.value = variants
  })
  const selects: Ref<{ name: string; value: string; items: string[] }[]> = ref([])
  const selectedKey = computed(() => selects.value.map(({ name, value }) => `${name}=${value}`).join(','))
  const selected = computed(() => blockState.value?.variants?.[selectedKey.value])

  return {
    selects,
    selected,
  }
}
