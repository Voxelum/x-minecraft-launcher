<template>
  <div class="mb-0 flex flex-col">
    <div
      class="flex flex-1 flex-grow-0 flex-row items-center justify-center"
    >
      <div
        class="flex flex-grow-0 flex-row items-center justify-center gap-1"
      >
        <AvatarItemList :items="extensionItems" />
      </div>
      <div class="flex-grow" />
      <MarketTextField
        :clearable="!!curseforgeCategory || modrinthCategories.length > 0 || !!keyword"
        :value="keyword"
        :placeholder="t('resourcepack.searchHint')"
        :game-version="gameVersion !== runtime.minecraft ? gameVersion : undefined"
        :category="!!curseforgeCategory || modrinthCategories.length > 0"
        :icon="filterMode === 'remote' ? 'storefront' : filterMode === 'local' ? 'inventory_2' : 'favorite'"
        @clear="onClear"
        @clear-version="gameVersion = runtime.minecraft"
        @input="keyword = $event ?? ''"
        @clear-category="onClear"
        @blur="focused = false"
      />
    </div>
    <MarketExtensions
    />
  </div>
</template>

<script lang=ts setup>
import AvatarItemList from '@/components/AvatarItemList.vue'
import MarketExtensions from '@/components/MarketExtensions.vue'
import MarketTextField from '@/components/MarketTextField.vue'
import { kInstance } from '@/composables/instance'
import { kInstanceResourcePacks } from '@/composables/instanceResourcePack'
import { kResourcePackSearch } from '@/composables/resourcePackSearch'
import { kSearchModel } from '@/composables/search'
import { getExtensionItemsFromRuntime } from '@/util/extensionItems'
import { injection } from '@/util/inject'
import { useQuery } from '@/composables/query'

const { path, runtime } = injection(kInstance)
const { enabled } = injection(kInstanceResourcePacks)
const extensionItems = computed(() => {
  return [...getExtensionItemsFromRuntime({ minecraft: runtime.value.minecraft }), {
    icon: 'palette',
    title: t('resourcepack.name', 2),
    text: t('resourcepack.enable', { count: enabled.value.length }),
  }]
})
const {
  keyword, modrinthCategories, curseforgeCategory,
  source: filterMode,
  sort, gameVersion,
} = injection(kSearchModel)
const focused = ref(false)
provide('focused', focused)
const selectedId = useQuery('id')
watch(focused, (v) => { if (v) selectedId.value = '' })
const onClear = () => {
  curseforgeCategory.value = undefined
  modrinthCategories.value = []
}
const { sortBy } = injection(kResourcePackSearch)

const { t } = useI18n()
</script>
