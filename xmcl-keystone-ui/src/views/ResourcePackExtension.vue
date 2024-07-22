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
        :keyword.sync="keyword"
        :placeholder="t('resourcepack.searchHint')"
        :modrinth-categories.sync="modrinthCategories"
        modrinth-category-filter="resourcepack"
        :curseforge-category.sync="curseforgeCategory"
        curseforge-category-filter="texture-packs"
        :enable-curseforge.sync="isCurseforgeActive"
        :enable-modrinth.sync="isModrinthActive"
        :sort.sync="sort"
        :game-version.sync="gameVersion"
      />
    </div>
    <MarketExtensions
      :modrinth="modrinth.length"
      :curseforge="curseforge.length"
      :local="local.length"
    />
  </div>
</template>

<script lang=ts setup>
import AvatarItemList from '@/components/AvatarItemList.vue'
import MarketExtensions from '@/components/MarketExtensions.vue'
import MarketTextFieldWithMenu from '@/components/MarketTextFieldWithMenu.vue'
import { useService } from '@/composables'
import { kInstance } from '@/composables/instance'
import { kResourcePackSearch } from '@/composables/resourcePackSearch'
import { getExtensionItemsFromRuntime } from '@/util/extensionItems'
import { injection } from '@/util/inject'
import { InstanceResourcePacksServiceKey } from '@xmcl/runtime-api'
import useSWRV from 'swrv'

const { path, runtime } = injection(kInstance)
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
  modrinth, curseforge, enabled, sort, local,
  isCurseforgeActive, isModrinthActive,
  gameVersion,
} = injection(kResourcePackSearch)

const { t } = useI18n()
</script>
