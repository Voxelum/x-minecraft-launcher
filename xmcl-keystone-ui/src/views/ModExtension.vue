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
          :local-sort.sync="sortBy"
          curseforge-category-filter="mc-mods"
          modrinth-category-filter="mod"
          :collection.sync="selectedCollection"
          :enable-curseforge.sync="isCurseforgeActive"
          :enable-modrinth.sync="isModrinthActive"
          :sort.sync="sort"
          :mode.sync="source"
          :game-version.sync="gameVersion"
          :modloader.sync="modLoader"
          :mod-loaders="[ModLoaderFilter.forge, ModLoaderFilter.neoforge, ModLoaderFilter.fabric, ModLoaderFilter.quilt]"
        >
          <template #local>
            <v-subheader class="flex">
              {{ t('mod.filter') }}
            </v-subheader>
            <v-btn-toggle
              background-color="transparent"
              :value="localFilter === 'disabledOnly' ? 0 : localFilter === 'incompatibleOnly' ? 1 : undefined"
              class="bg-transparent px-1"
              @change="onUpdateLocalFilter(filterItems[$event]?.value)"
            >
              <v-btn
                v-for="tag in filterItems"
                :key="tag.value"
                v-shared-tooltip="_ => tag.text"
                :disabled="tag.disabled"
                small
                outlined
              >
                <v-icon
                  class="material-icons-outlined"
                  small
                >
                  {{ tag.icon }}
                </v-icon>
              </v-btn>
            </v-btn-toggle>
            <ModOptionsPage
              :denseView.sync="denseView"
              :groupInstalled.sync="groupInstalled"
            />
          </template>
        </MarketTextFieldWithMenu>
      </div>
    </div>
    <MarketExtensions />
  </div>
</template>

<script lang=ts setup>
import AvatarItemList from '@/components/AvatarItemList.vue'
import MarketExtensions from '@/components/MarketExtensions.vue'
import MarketTextFieldWithMenu from '@/components/MarketTextFieldWithMenu.vue'
import { kInstance } from '@/composables/instance'
import { kInstanceModsContext } from '@/composables/instanceMods'
import { kModsSearch } from '@/composables/modSearch'
import { getExtensionItemsFromRuntime } from '@/util/extensionItems'
import { injection } from '@/util/inject'
import debounce from 'lodash.debounce'
import ModOptionsPage from './ModOptionsPage.vue'
import { vSharedTooltip } from '@/directives/sharedTooltip'
import { kModUpgrade } from '@/composables/modUpgrade'
import { kModDependenciesCheck } from '@/composables/modDependenciesCheck'
import { kModLibCleaner } from '@/composables/modLibCleaner'
import { ModLoaderFilter, kSearchModel } from '@/composables/search'

const { runtime: version } = injection(kInstance)
const { plans } = injection(kModUpgrade)
const { curseforgeCategory, modrinthCategories, isCurseforgeActive, isModrinthActive, sort, modLoader, selectedCollection, gameVersion, source } = injection(kSearchModel)
const { denseView, groupInstalled, sortBy, localFilter } = injection(kModsSearch)
const { mods: modFiles } = injection(kInstanceModsContext)
const { t } = useI18n()
const { installation } = injection(kModDependenciesCheck)
const { unusedMods } = injection(kModLibCleaner)


const filterItems = computed(() => {
  const hasUpdate = Object.keys(plans.value).length > 0
  const hasDependenciesInstall = Object.keys(installation.value).length > 0
  const hasUnusedMods = Object.keys(unusedMods.value).length > 0
  const result = [{
    icon: 'flash_off',
    text: t('modFilter.disabledOnly'),
    disabled: false,
    value: 'disabledOnly',
  }, {
    icon: 'info',
    text: t('modFilter.incompatibleOnly'),
    value: 'incompatibleOnly',
  }]
  result.push({
    icon: 'recycling',
    disabled: !hasUnusedMods,
    text: t('modFilter.unusedOnly'),
    value: 'unusedOnly',
  })
  result.push({
    icon: 'merge',
    disabled: !hasDependenciesInstall,
    text: t('modFilter.dependenciesInstallOnly'),
    value: 'dependenciesInstallOnly',
  })
  result.push({
    icon: 'update',
    disabled: !hasUpdate,
    text: t('modFilter.hasUpdateOnly'),
    value: 'hasUpdateOnly',
  })
  return result
})

function onUpdateLocalFilter(filter: string) {
  localFilter.value = filter as any
}

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
