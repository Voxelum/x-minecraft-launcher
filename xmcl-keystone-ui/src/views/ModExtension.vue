<template>
  <div class="mb-0 flex flex-col">
    <div class="flex flex-1 flex-grow-0 flex-row items-center justify-center">
      <div class="flex flex-grow-0 flex-row items-center justify-center gap-1">
        <AvatarItemList :items="extensionItems" />
      </div>
      <div class="flex-grow" />
      <div class="invisible-scroll flex flex-grow justify-end gap-4 overflow-x-auto">
        <MarketTextField
          :clearable="!!curseforgeCategory || modrinthCategories.length > 0 || !!keywordBuffer"
          :value="keywordBuffer"
          :placeholder="t('mod.search') + ' / ' + (source === 'remote' ? t('search.market') : source === 'local' ? t('search.local') : t('search.favorate')) "
          :game-version="gameVersion !== version.minecraft ? gameVersion : undefined"
          :category="!!curseforgeCategory || modrinthCategories.length > 0"
          :icon="source === 'remote' ? 'storefront' : source === 'local' ? 'inventory_2' : 'favorite'"
          @clear="onClear"
          @clear-version="gameVersion = version.minecraft"
          @input="keywordBuffer = $event ?? ''"
          @clear-category="onClear"
          @blur="focused = false"
        />
      </div>
    </div>
    <MarketExtensions />
  </div>
</template>

<script lang=ts setup>
import AvatarItemList from '@/components/AvatarItemList.vue'
import MarketExtensions from '@/components/MarketExtensions.vue'
import MarketTextField from '@/components/MarketTextField.vue'
import { kInstance } from '@/composables/instance'
import { kInstanceModsContext } from '@/composables/instanceMods'
import { getExtensionItemsFromRuntime } from '@/util/extensionItems'
import { injection } from '@/util/inject'
import { useDebounceFn } from '@vueuse/core'
import { kSearchModel } from '@/composables/search'
import { useQuery } from '@/composables/query'

const { runtime: version } = injection(kInstance)
const { curseforgeCategory, modrinthCategories, gameVersion, source } = injection(kSearchModel)
const { mods: modFiles } = injection(kInstanceModsContext)
const { t } = useI18n()

// Focusing the search field deselects the current item so the filter panel
// (the default "nothing selected" right-pane content) is shown.
const focused = ref(false)
provide('focused', focused)
const selectedId = useQuery('id')
watch(focused, (v) => { if (v) selectedId.value = '' })

const onClear = () => {
  curseforgeCategory.value = undefined
  modrinthCategories.value = []
}

const route = useRoute()
const updateSearch = useDebounceFn(() => {
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

watch(() => route.query.keyword, (v) => {
  keywordBuffer.value = v as string ?? ''
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
