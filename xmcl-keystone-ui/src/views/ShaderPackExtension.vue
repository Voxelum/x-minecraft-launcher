<template>
  <div
    class="mb-0 flex flex-col pl-4 pr-6"
  >
    <div
      class="flex flex-1 flex-grow-0 flex-row items-center justify-center gap-2"
    >
      <AvatarItemList :items="extensionItems" />
      <div class="flex-grow" />
      <MarketTextFieldWithMenu
        :keyword.sync="keyword"
        :placeholder="t('shaderPack.searchHint')"
        :modrinth-categories.sync="modrinthCategories"
        modrinth-category-filter="shader"
        :enable-modrinth.sync="isModrinthActive"
        :game-version.sync="gameVersion"
        :local-sort.sync="sortBy"
        :sort.sync="sort"
        :mode.sync="source"
        :collection.sync="selectedCollection"
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
import MarketTextFieldWithMenu from '@/components/MarketTextFieldWithMenu.vue'
import { kInstance } from '@/composables/instance'
import { kInstanceShaderPacks } from '@/composables/instanceShaderPack'
import { kSearchModel } from '@/composables/search'
import { kShaderPackSearch } from '@/composables/shaderPackSearch'
import { getExtensionItemsFromRuntime } from '@/util/extensionItems'
import { injection } from '@/util/inject'

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
const { shaderMod } = injection(kInstanceShaderPacks)
const { sortBy } = injection(kShaderPackSearch)
const { t } = useI18n()
</script>
