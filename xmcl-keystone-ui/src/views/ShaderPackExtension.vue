<template>
  <div
    class="mb-0 flex flex-col pl-4 pr-6"
  >
    <div
      class="flex flex-1 flex-grow-0 flex-row items-center justify-center gap-2"
    >
      <AvatarItemList :items="extensionItems" />
      <div class="flex-grow" />
      <v-btn-toggle
        v-model="shaderLoaderFilters"
        multiple
        dense
      >
        <v-btn
          icon
          text
          value="iris"
        >
          <v-img
            width="28"
            :src="'http://launcher/icons/iris'"
          />
        </v-btn>

        <v-btn
          icon
          text
          value="optifine"
        >
          <v-img
            width="28"
            :src="'http://launcher/icons/optifine'"
          />
        </v-btn>
      </v-btn-toggle>
      <MarketTextFieldWithMenu
        :keyword.sync="keyword"
        :placeholder="t('shaderPack.searchHint')"
        :modrinth-categories.sync="modrinthCategories"
        modrinth-category-filter="shader"
        :enable-modrinth.sync="isModrinthActive"
        :sort.sync="sort"
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
  return items
})

const { keyword, shaderLoaderFilters, modrinthCategories, sort, isModrinthActive } = injection(kShaderPackSearch)
const { shaderMod } = injection(kInstanceShaderPacks)
const { t } = useI18n()
</script>
