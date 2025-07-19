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
      <MarketTextFieldWithMenu
        v-model:keyword="keyword"
        v-model:modrinth-categories="modrinthCategories"
        v-model:local-sort="sortBy"
        v-model:curseforge-category="curseforgeCategory"
        v-model:enable-curseforge="isCurseforgeActive"
        v-model:enable-modrinth="isModrinthActive"
        v-model:sort="sort"
        v-model:game-version="gameVersion"
        v-model:mode="filterMode"
        v-model:collection="selectedCollection"
        :placeholder="t('resourcepack.searchHint')"
        modrinth-category-filter="resourcepack"
        curseforge-category-filter="texture-packs"
      />
    </div>
    <MarketExtensions />
  </div>
</template>

<script lang=ts setup>
import AvatarItemList from '@/components/AvatarItemList.vue'
import MarketExtensions from '@/components/MarketExtensions.vue'
import MarketTextFieldWithMenu from '@/components/MarketTextFieldWithMenu.vue'
import { useService } from '@/composables'
import { kInstance } from '@/composables/instance'
import { kInstanceResourcePacks } from '@/composables/instanceResourcePack'
import { kResourcePackSearch } from '@/composables/resourcePackSearch'
import { kSearchModel } from '@/composables/search'
import { getExtensionItemsFromRuntime } from '@/util/extensionItems'
import { injection } from '@/util/inject'
import { InstanceResourcePacksServiceKey } from '@xmcl/runtime-api'
import useSWRV from 'swrv'

const { path, runtime } = injection(kInstance)
const { enabled } = injection(kInstanceResourcePacks)
const extensionItems = computed(() => {
  return [...getExtensionItemsFromRuntime({ minecraft: runtime.value.minecraft }), {
    icon: 'palette',
    title: t('resourcepack.name', 2),
    text: t('resourcepack.enable', { count: enabled.value.length }),
  }, {
    icon: isInstanceLinked.value ? 'account_tree' : 'looks_one',
    title: t('resourcepack.name', 2) + ' ',
    text: isInstanceLinked.value ? t('resourcepack.shared') : t('resourcepack.independent'),
  }]
})
const { isLinked } = useService(InstanceResourcePacksServiceKey)
const { data: isInstanceLinked } = useSWRV(computed(() => path.value), isLinked)
const {
  keyword, modrinthCategories, curseforgeCategory,
  isCurseforgeActive, isModrinthActive, source: filterMode, selectedCollection,
  sort, gameVersion,
} = injection(kSearchModel)
const { sortBy } = injection(kResourcePackSearch)

const { t } = useI18n()
</script>
