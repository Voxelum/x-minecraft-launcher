<template>
  <div
    class="relative flex h-full select-none flex-col overflow-auto pb-0"
    @wheel.stop
  >
    <v-progress-linear
      class="absolute left-0 top-0 z-20 m-0 p-0"
      :active="loading"
      height="3"
      :indeterminate="true"
    />
    <SplitPane
      flex-left
      :min-percent="30"
      :default-percent="30"
      class="flex h-full w-full overflow-auto py-0"
    >
      <template #left>
        <div class="flex flex-grow-0 items-center px-4">
          <v-subheader class="responsive-header py-2 pl-0">
            <v-btn
              text
              small
              :disabled="installed.length === 0"
              :loading="checkingUpgrade"
              @click="checkUpgrade"
            >
              <template v-if="!checkedUpgrade">
                <v-icon left>
                  refresh
                </v-icon>
                <span>
                  {{ t('modInstall.checkUpgrade') }}
                </span>
              </template>
              <template v-else>
                <v-icon
                  color="primary"
                  left
                >
                  check
                </v-icon>
                <span>
                  {{ t('modInstall.checkedUpgrade') }}
                </span>
              </template>
            </v-btn>
            <div class="flex-grow" />

            <v-btn
              text
              small
              :disabled="Object.keys(plans).length === 0"
              :loading="upgrading"
              @click="upgrade"
            >
              <v-icon left>
                upgrade
              </v-icon>
              <span>
                {{ t('modInstall.upgrade') }}
              </span>
            </v-btn>
            <!-- <v-divider
              vertical
              class="mx-2"
            /> -->
            <!-- <span class="search-text">
              {{ t('modInstall.search') }}
            </span>
            <span
              v-if="counts.searched > 0"
              class="ml-2"
            >
              {{ t('items.count', { count: counts.searched }) }}
              <span v-if="total">
                /
                {{ t('items.total', { total: total }) }}
              </span>
            </span> -->
          </v-subheader>
        </div>
        <v-virtual-scroll
          :bench="2"
          class="visible-scroll h-full max-h-full w-full overflow-auto"
          :items="items"
          item-height="91"
          @scroll="onScroll"
        >
          <template #default="{ item }">
            <ModItem
              v-if="typeof item !== 'string'"
              :item="item"
              :has-update="!!plans[item.id]"
              :selection-mode="false"
              :selected="(selectedItem && selectedItem.id === item.id) || false"
              @click="onSelect(item)"
            />
            <template v-else-if="item === 'installed'">
              <v-subheader class="flex h-[81px] items-center justify-center px-4">
                <v-divider class="mr-3" />
                <v-icon left>
                  archive
                </v-icon>
                <span class="mr-2">
                  {{ t('modInstall.installed') }}
                </span>
                <span>
                  {{ t('items.count', { count: counts.installed }) }}
                </span>

                <span v-if="Object.keys(plans).length">
                  , {{ t('mod.toUpdate', { count: Object.keys(plans).length }) }}
                </span>
                <v-divider class="ml-3" />
              </v-subheader>
            </template>
            <template v-else-if="item === 'search'">
              <v-subheader class="flex h-[81px] items-center justify-center px-4">
                <v-divider class="mr-3" />
                <v-icon left>
                  archive
                </v-icon>
                <span class="mr-2">
                  {{ t('modInstall.search') }}
                </span>
                <span v-if="counts.searched > 0">
                  {{ t('items.count', { count: counts.searched }) }}
                  <span v-if="total">
                    /
                    {{ t('items.total', { total: total }) }}
                  </span>
                </span>
                <v-divider class="ml-3" />
              </v-subheader>
            </template>
          </template>
        </v-virtual-scroll>
        <ErrorView
          v-if="tab === 3 && modrinthError"
          :error="modrinthError"
        />
        <ErrorView
          v-if="tab === 2 && curseforgeError"
          :error="curseforgeError"
        />
      </template>
      <template #right>
        <div class="flex h-full flex-grow-0 overflow-y-auto overflow-x-hidden">
          <ModDetailModrinth
            v-if="(selectedItem && selectedItem.modrinth) || selectedModrinthId"
            :modrinth="selectedItem?.modrinth"
            :project-id="selectedModrinthId"
            :updating="plans[selectedItem?.id ?? '']?.updating"
            :runtime="runtime"
            :installed="selectedItem?.installed || getInstalledModrinth(selectedModrinthId)"
            :minecraft="minecraft"
          />
          <ModDetailCurseforge
            v-else-if="(selectedItem && selectedItem.curseforge) || selectedCurseforgeId"
            :curseforge="selectedItem?.curseforge"
            :curseforge-id="Number(selectedCurseforgeId)"
            :updating="plans[selectedItem?.id ?? '']?.updating"
            :runtime="runtime"
            :minecraft="minecraft"
            :installed="selectedItem?.installed || getInstalledCurseforge(selectedCurseforgeId)"
          />
          <ModDetailResource
            v-else-if="selectedItem && selectedItem.files && selectedItem"
            :mod="selectedItem"
            :files="selectedItem.files"
            :runtime="runtime"
            :installed="selectedItem.installed"
            :minecraft="minecraft"
          />
          <Hint
            v-else
            :text="t('modInstall.searchHint')"
            icon="playlist_add"
          />
        </div>
      </template>
    </SplitPane>
  </div>
</template>

<script lang=ts setup>
import ErrorView from '@/components/ErrorView.vue'
import Hint from '@/components/Hint.vue'
import SplitPane from '@/components/SplitPane.vue'
import { kInstanceModsContext } from '@/composables/instanceMods'
import { kInstanceVersion } from '@/composables/instanceVersion'
import { kModsSearch } from '@/composables/modSearch'
import { kMods } from '@/composables/mods'
import { kCompact } from '@/composables/scrollTop'
import { injection } from '@/util/inject'
import { Mod } from '@/util/mod'
import ModDetailCurseforge from './ModDetailCurseforge.vue'
import ModDetailModrinth from './ModDetailModrinth.vue'
import ModDetailResource from './ModDetailResource.vue'
import ModItem from './ModItem.vue'
import { kModUpgrade } from '@/composables/modUpgrade'
import { kInstance } from '@/composables/instance'

const { minecraft } = injection(kInstanceVersion)
const { runtime } = injection(kInstance)

const modLoaderFilters = ref([] as string[])
onMounted(() => {
  const items = [] as string[]
  if (runtime.value.fabricLoader) {
    items.push('fabric')
  }
  if (runtime.value.forge) {
    items.push('forge')
  }
  if (runtime.value.quiltLoader) {
    items.push('quilt')
  }
  modLoaderFilters.value = items
})

const { provideRuntime } = injection(kInstanceModsContext)

watch(provideRuntime, v => console.log(v), { immediate: true })

const {
  modrinth, modrinthError,
  curseforge, curseforgeError,
  loading,
  loadMoreCurseforge,
  loadMoreModrinth,
  keyword,
  loadingCurseforge,
  loadingModrinth,
} = injection(kModsSearch)
const { search, installed, tab } = injection(kMods)

const { plans, refresh: checkUpgrade, refreshing: checkingUpgrade, checked: checkedUpgrade, upgrade, upgradeError, upgrading } = injection(kModUpgrade)
const items = computed(() => {
  const allowForge = modLoaderFilters.value.indexOf('forge') !== -1
  const allowFabric = modLoaderFilters.value.indexOf('fabric') !== -1
  const allowQuilt = modLoaderFilters.value.indexOf('quilt') !== -1
  const filter = (a: Mod | string) => typeof a === 'string' ? true : (allowForge && a.forge) || (allowFabric && a.fabric) || (allowQuilt && a.quilt) || a.modrinth || a.curseforge || a.installed

  const filteredInstalled = installed.value
  const installedItem = filteredInstalled.length > 0 ? ['installed', ...filteredInstalled] : []

  const filteredSearch = search.value.filter(filter)
  const searchItem = filteredSearch.length > 0 ? ['search', ...filteredSearch] : []

  return [...installedItem, ...searchItem]
})
const counts = computed(() => {
  return {
    installed: installed.value.length,
    searched: search.value.length,
  }
})

const { replace } = useRouter()
const route = useRoute()

const selectedId = computed({
  get: () => route.query.id as string | undefined,
  set: (v) => {
    if (route.query.id !== v) {
      replace({ query: { ...route.query, id: v } })
    }
  },
})
const selectedItem = computed(() => {
  if (!selectedId.value) return undefined
  return items.value.find((i): i is Mod => typeof i !== 'string' && i.id === selectedId.value)
})
const selectedModrinthId = computed(() => {
  const id = selectedId.value
  if (id && id?.startsWith('modrinth:')) {
    return id.substring('modrinth:'.length)
  }
  return selectedItem.value?.modrinthProjectId || selectedItem.value?.modrinth?.project_id || ''
})
const selectedCurseforgeId = computed(() => {
  const id = selectedId.value
  if (id && id?.startsWith('curseforge:')) {
    return Number(id.substring('curseforge:'.length))
  }
  return selectedItem.value?.curseforgeProjectId || selectedItem.value?.curseforge?.id || undefined
})
const onSelect = (i: Mod) => {
  selectedId.value = i.id
}

const { mods } = injection(kInstanceModsContext)
const getInstalledModrinth = (projectId: string) => {
  return mods.value.filter((m) => m.modrinth?.projectId === projectId)
}
const getInstalledCurseforge = (modId: number | undefined) => {
  return mods.value.filter((m) => m.curseforge?.projectId === modId)
}

watch(computed(() => route.fullPath), () => {
  keyword.value = route.query.keyword as string ?? ''
}, { immediate: true })

const total = computed(() => {
  if (tab.value === 3) {
    return modrinth.value?.total_hits || 0
  }
  if (tab.value === 2) {
    return curseforge.value?.pagination.totalCount || 0
  }
  return 0
})

const onScroll = (e: Event) => {
  const target = e.target as HTMLElement
  if (!target) return
  if (target.scrollTop + target.clientHeight >= target.scrollHeight - 100) {
    if (tab.value === 2) {
      loadMoreCurseforge()
    } else if (tab.value === 3) {
      loadMoreModrinth()
    }
  }
}

const { t } = useI18n()
const compact = injection(kCompact)
onMounted(() => {
  compact.value = true
})
</script>

<style scoped>
.search-text {
  display: none;
}

@container (min-width: 260px) {
  .search-text {
    display: block;
  }
}

.responsive-header {
  container-type: size;
  width: 100%;
}
</style>
