<template>
  <div
    class="mt-4 flex flex-1 flex-grow-0 flex-row items-center justify-center gap-2 pl-4 pr-6"
    :class="{
      'mb-4': !compact,
      'mb-2': compact,
    }"
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
          :src="'image://builtin/iris'"
        />
      </v-btn>

      <v-btn
        icon
        text
        value="optifine"
      >
        <v-img
          width="28"
          :src="'image://builtin/optifine'"
        />
      </v-btn>
    </v-btn-toggle>
    <MarketTextFieldWithMenu
      :keyword.sync="keyword"
      :placeholder="t('shaderPack.searchHint')"
      :modrinth-categories.sync="modrinthCategories"
      modrinth-category-filter="shader"
    />
  </div>
</template>

<script lang=ts setup>
import AvatarItemList from '@/components/AvatarItemList.vue'
import MarketTextFieldWithMenu from '@/components/MarketTextFieldWithMenu.vue'
import { kInstance } from '@/composables/instance'
import { kInstanceShaderPacks } from '@/composables/instanceShaderPack'
import { kCompact } from '@/composables/scrollTop'
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
  return [{
    icon: 'gradient',
    title: t('shaderPack.name', 2),
    text: shaderPack.value,
  }, ...items]
})

const { keyword, shaderLoaderFilters, modrinthCategories } = injection(kShaderPackSearch)
const { shaderMod, shaderPack } = injection(kInstanceShaderPacks)
const { t } = useI18n()
const compact = injection(kCompact)
</script>
