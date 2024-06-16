<template>
  <div class="mb-0 flex flex-col">
    <div class="flex flex-1 flex-grow-0 flex-row items-center justify-center">
      <div class="flex flex-grow-0 flex-row items-center justify-center gap-1">
        <AvatarItemList :items="extensionItems" />
      </div>
      <div class="flex-grow" />
      <div class="invisible-scroll flex justify-end gap-4 overflow-x-auto">
        <v-btn-toggle
          v-model="modLoaderFilters"
          multiple
          dense
        >
          <v-btn
            icon
            text
            class="h-10"
            value="forge"
          >
            <v-img
              width="28"
              :src="'http://launcher/icons/forge'"
            />
          </v-btn>

          <v-btn
            icon
            text
            class="h-10"
            value="neoforge"
          >
            <v-img
              width="28"
              :src="'http://launcher/icons/neoForged'"
            />
          </v-btn>

          <v-btn
            icon
            class="h-10"
            text
            value="fabric"
          >
            <v-img
              width="28"
              :src="'http://launcher/icons/fabric'"
            />
          </v-btn>

          <v-btn
            icon
            class="h-10"
            text
            value="quilt"
          >
            <v-img
              width="28"
              :src="'http://launcher/icons/quilt'"
            />
          </v-btn>
        </v-btn-toggle>
        <MarketTextFieldWithMenu
          :placeholder="t('mod.search')"
          :keyword.sync="_keyword"
          :curseforge-category.sync="curseforgeCategory"
          :modrinth-categories.sync="modrinthCategories"
          curseforge-category-filter="mc-mods"
          modrinth-category-filter="mod"
          :enable-curseforge.sync="isCurseforgeActive"
          :enable-modrinth.sync="isModrinthActive"
          :sort.sync="sort"
          :game-version.sync="gameVersion"
          :modloader.sync="modLoader"
        />
      </div>
    </div>
    <MarketExtensions
      :modrinth="modrinthCount"
      :curseforge="curseforgeCount"
      :local="cachedMods.length"
    />
  </div>
</template>

<script lang=ts setup>
import AvatarItemList from '@/components/AvatarItemList.vue'
import MarketExtensions from '@/components/MarketExtensions.vue'
import MarketTextFieldWithMenu from '@/components/MarketTextFieldWithMenu.vue'
import { kInstance } from '@/composables/instance'
import { kModsSearch } from '@/composables/modSearch'
import { useQuery } from '@/composables/query'
import { getExtensionItemsFromRuntime } from '@/util/extensionItems'
import { injection } from '@/util/inject'
import debounce from 'lodash.debounce'

const { runtime: version } = injection(kInstance)
const { modrinth, curseforge, instanceMods, gameVersion, cachedMods, modLoaderFilters, curseforgeCategory, modrinthCategories, isCurseforgeActive, isModrinthActive, sort } = injection(kModsSearch)
const curseforgeCount = computed(() => curseforge.value ? curseforge.value.length : 0)
const modrinthCount = computed(() => modrinth.value ? modrinth.value.length : 0)
const { t } = useI18n()

let buffer = undefined as undefined | string
const updateSearch = debounce(() => {
  if (typeof buffer === 'string') {
    replace({ query: { ...route.query, keyword: buffer } })
    buffer = undefined
  }
}, 500)
const { replace } = useRouter()
const route = useRoute()
const _keyword = computed({
  get: () => route.query.keyword as string ?? '',
  set: (v) => {
    if (v !== buffer) {
      if (v === '') {
        replace({ query: { ...route.query, keyword: v } })
        buffer = undefined
      } else {
        buffer = v ?? ''
        updateSearch()
      }
    }
  },
})
const modLoader = useQuery('modLoader')

watch(version, (v) => {
  // gameVersion.value = v.minecraft
  if (v.forge) {
    modLoader.value = 'forge'
  } else if (v.fabric) {
    modLoader.value = 'fabric'
  } else if (v.quilt) {
    modLoader.value = 'quilt'
  }
}, { immediate: true })

const extensionItems = computed(() => [
  {
    icon: 'folder_zip',
    title: t('mod.name', { count: 2 }),
    text: t('mod.enabled', { count: instanceMods.value.length }),
  },
  ...getExtensionItemsFromRuntime(version.value),
])

</script>
