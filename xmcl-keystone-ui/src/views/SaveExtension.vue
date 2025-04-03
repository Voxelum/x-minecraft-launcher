<template>
  <div
    class="z-5 flex flex-shrink flex-grow-0 items-center gap-2"
    outlined
    elevation="1"
    :class="{
      'mb-3': !compact,
      'mb-2': compact,
    }"
  >
    <div class="flex flex-grow-0 flex-row items-center justify-center gap-1">
      <AvatarItemList :items="items" />
    </div>
    <v-spacer />
    <MarketTextFieldWithMenu
      no-tab
     :placeholder="t('save.search')"
      :keyword.sync="keyword"
      :curseforge-category.sync="curseforgeCategory"
      curseforge-category-filter="worlds"
      :modrinth-categories="[]"
      :modrinth-category-filter="''"
      :enable-curseforge.sync="isCurseforgeActive"
      :sort.sync="sort"
      :mode="'remote'"
      :game-version.sync="gameVersion"
    />
  </div>
</template>

<script lang="ts" setup>
import AvatarItemList from '@/components/AvatarItemList.vue'
import MarketTextFieldWithMenu from '@/components/MarketTextFieldWithMenu.vue'
import { kInstance } from '@/composables/instance'
import { kInstanceSave } from '@/composables/instanceSave'
import { kCompact } from '@/composables/scrollTop'
import { kSearchModel } from '@/composables/search'
import { getExtensionItemsFromRuntime } from '@/util/extensionItems'
import { injection } from '@/util/inject'

const { keyword, source, gameVersion, curseforgeCategory, isCurseforgeActive, sort } = injection(kSearchModel)

const { runtime: version } = injection(kInstance)
const { isInstanceLinked } = injection(kInstanceSave)
const { t } = useI18n()

const items = computed(() => {
  return [
    ...getExtensionItemsFromRuntime({ minecraft: version.value.minecraft }),
    {
      icon: isInstanceLinked.value ? 'account_tree' : 'looks_one',
      title: t('save.name', 2),
      text: isInstanceLinked.value ? t('save.shared') : t('save.independent'),
    },
  ]
})
const compact = injection(kCompact)
</script>
