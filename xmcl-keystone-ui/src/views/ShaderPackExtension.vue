<template>
  <div
    class="mb-0 flex flex-col pl-4 pr-6"
  >
    <div
      class="flex flex-1 flex-grow-0 flex-row items-center justify-center gap-2"
    >
      <AvatarItemList :items="extensionItems" />
      <div class="flex-grow" />
      <MarketTextField
        :clearable="modrinthCategories.length > 0 || !!keyword"
        :value="keyword"
        :placeholder="t('shaderPack.searchHint')"
        :game-version="gameVersion !== version.minecraft ? gameVersion : undefined"
        :category="modrinthCategories.length > 0"
        :icon="source === 'remote' ? 'storefront' : source === 'local' ? 'inventory_2' : 'favorite'"
        @clear="modrinthCategories = []"
        @clear-version="gameVersion = version.minecraft"
        @input="keyword = $event ?? ''"
        @clear-category="modrinthCategories = []"
        @blur="focused = false"
      />
    </div>
    <MarketExtensions
      :modrinth="0"
      :curseforge="0"
      :local="0"
    />
  </div>
</template>

<script lang=ts setup>
import AvatarItemList from '@/components/AvatarItemList.vue'
import MarketExtensions from '@/components/MarketExtensions.vue'
import MarketTextField from '@/components/MarketTextField.vue'
import { kInstance } from '@/composables/instance'
import { kInstanceShaderPacks } from '@/composables/instanceShaderPack'
import { kSearchModel } from '@/composables/search'
import { kShaderPackSearch } from '@/composables/shaderPackSearch'
import { getExtensionItemsFromRuntime } from '@/util/extensionItems'
import { injection } from '@/util/inject'
import { useQuery } from '@/composables/query'

const { runtime: version } = injection(kInstance)

const extensionItems = computed(() => {
  const items = getExtensionItemsFromRuntime(version.value)
  const optifineIndex = items.findIndex((item) => item.title === 'Optifine')
  if (optifineIndex !== -1) {
    items.splice(optifineIndex, 1)
  }
  if (shaderMod.value) {
    items.push({
      avatar: shaderMod.value.icon ?? '',
      title: shaderMod.value.name ?? '',
      text: shaderMod.value.version,
    })
  }
  if (!shaderMod.value && optifineIndex === -1) {
    items.push({
      icon: 'error',
      title: t('shaderPack.noShaderMod'),
      text: t('shaderPack.noShaderModHint'),
      color: 'warning',
    })
  }
  return items
})

const { keyword, source, gameVersion, selectedCollection, modrinthCategories, sort, isModrinthActive } = injection(kSearchModel)
const focused = ref(false)
provide('focused', focused)
const selectedId = useQuery('id')
watch(focused, (v) => { if (v) selectedId.value = '' })
const { shaderMod } = injection(kInstanceShaderPacks)
const { sortBy } = injection(kShaderPackSearch)
const { t } = useI18n()
</script>
