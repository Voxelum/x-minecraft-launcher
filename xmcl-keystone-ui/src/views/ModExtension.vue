<template>
  <div class="mb-0 flex flex-col">
    <div class="flex flex-1 flex-grow-0 flex-row items-center justify-center">
      <div class="flex flex-grow-0 flex-row items-center justify-center gap-1">
        <AvatarItemList :items="extensionItems" />
      </div>
      <div class="flex-grow" />
      <div class="invisible-scroll flex justify-end gap-4 overflow-x-auto">
        <MarketTextFieldWithMenu
          :placeholder="t('mod.search')"
          :keyword.sync="keywordBuffer"
          :curseforge-category.sync="curseforgeCategory"
          :modrinth-categories.sync="modrinthCategories"
          curseforge-category-filter="mc-mods"
          modrinth-category-filter="mod"
          :enable-curseforge.sync="isCurseforgeActive"
          :enable-modrinth.sync="isModrinthActive"
          :local-only.sync="localOnly"
          :sort.sync="sort"
          :game-version.sync="gameVersion"
          :modloader.sync="modLoader"
          :mod-loaders="[ModLoaderFilter.forge, ModLoaderFilter.neoforge, ModLoaderFilter.fabric, ModLoaderFilter.quilt]"
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
import { kInstanceModsContext } from '@/composables/instanceMods'
import { kModsSearch, ModLoaderFilter } from '@/composables/modSearch'
import { getExtensionItemsFromRuntime } from '@/util/extensionItems'
import { injection } from '@/util/inject'
import debounce from 'lodash.debounce'

const { runtime: version } = injection(kInstance)
const { modrinth, curseforge, gameVersion, cachedMods, localOnly, curseforgeCategory, modrinthCategories, isCurseforgeActive, isModrinthActive, sort, modLoader } = injection(kModsSearch)
const { mods: modFiles } = injection(kInstanceModsContext)
const curseforgeCount = computed(() => curseforge.value ? curseforge.value.length : 0)
const modrinthCount = computed(() => modrinth.value ? modrinth.value.length : 0)
const { t } = useI18n()

const route = useRoute()
const updateSearch = debounce(() => {
  const buffer = keywordBuffer.value
  if (buffer) {
    const isSuperQuery = buffer.startsWith('@')
    if (isSuperQuery) {
      const query = buffer.substring(1)
      const isCurseforgeProjectId = /^\d+$/.test(query) && query.length < 10
      const isModrinthProject = /^[0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz]+$/.test(query) && query.length === 8
      if (isCurseforgeProjectId) {
        if (route.query.id === `curseforge:${query}`) return
        replace({ query: { ...route.query, id: `curseforge:${query}` } })
      } else if (isModrinthProject) {
        if (route.query.id === `modrinth:${query}`) return
        replace({ query: { ...route.query, id: `modrinth:${query}` } })
      } else {
        if (route.query.keyword === query) return
        replace({ query: { ...route.query, keyword: query } })
      }
    } else {
      if (route.query.keyword === buffer) return
      replace({ query: { ...route.query, keyword: buffer } })
    }
  } else {
    if (route.query.keyword === '') return
    replace({ query: { ...route.query, keyword: '' } })
  }
}, 500)
const { replace } = useRouter()
const keywordBuffer = ref(route.query.keyword as string)

onMounted(() => {
  keywordBuffer.value = route.query.keyword as string ?? ''
})

watch(keywordBuffer, (v, old) => {
  if (v !== old) {
    updateSearch()
  }
}, { immediate: true })

const extensionItems = computed(() => [
  {
    icon: 'folder_zip',
    title: t('mod.name', { count: 2 }),
    text: t('mod.enabled', { count: modFiles.value.filter(v => v.enabled).length }),
  },
  ...getExtensionItemsFromRuntime(version.value),
])

</script>
