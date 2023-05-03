<template>
  <div
    class="flex flex-col select-none h-full overflow-auto pb-0"
    @wheel.stop
  >
    <v-progress-linear
      class="absolute top-0 z-10 m-0 p-0 left-0"
      :active="loading"
      height="3"
      :indeterminate="true"
    />

    <SplitPane
      flex-left
      :min-percent="30"
      class="h-full overflow-auto py-0 w-full flex"
    >
      <template
        #left
      >
        <div class="flex flex-grow-0 px-4 items-center">
          <v-subheader class="pl-0 py-2 responsive-header">
            <v-icon left>
              travel_explore
            </v-icon>
            <span class="search-text">
              {{ t('modInstall.search') }}
            </span>
            <v-divider
              vertical
              class="mx-2"
            />
            <span>
              {{ t('items.count', { count: counts.searched }) }}
              <span v-if="total">
                /
                {{ t('items.total', { total: total }) }}
              </span>
            </span>
          </v-subheader>
          <div class="flex-grow" />
          <v-btn-toggle
            v-model="modLoaderFilters"
            multiple
            dense
          >
            <v-btn
              icon
              text
              value="forge"
            >
              <v-img
                width="28"
                :src="'image://builtin/forge'"
              />
            </v-btn>

            <v-btn
              icon
              text
              value="fabric"
            >
              <v-img
                width="28"
                :src="'image://builtin/fabric'"
              />
            </v-btn>

            <v-btn
              icon
              text
              value="quilt"
            >
              <v-img
                width="28"
                :src="'image://builtin/quilt'"
              />
            </v-btn>
          </v-btn-toggle>
        </div>
        <v-virtual-scroll
          :bench="2"
          class="h-full max-h-full visible-scroll overflow-auto w-full"
          :items="items"
          item-height="68"
          @scroll="onScroll"
        >
          <template #default="{ item }">
            <ModAddSearchItem
              v-if="!item.divider"
              :item="item"
              :selected="(selected && selected.id === item.id ) || false"
              @click="onSelect(item)"
            />
            <template v-else>
              <v-subheader class="px-4 py-2 flex justify-center">
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
        <SplitPane
          :min-percent="30"
          split="horizontal"
        >
          <template #left>
            <div
              class="h-full overflow-auto flex flex-grow"
            >
              <template v-if="selected">
                <ModAddModrinthDetail
                  v-if="selected.modrinth && selected"
                  :hint="selected.modrinth"
                  :loader="forge ? 'forge' : fabricLoader ? 'fabric' : ''"
                  :minecraft="minecraft"
                  @install="onInstallModrinth($event, selected)"
                />
                <ModAddCurseforgeDetail
                  v-else-if="selected.curseforge"
                  :mod="selected.curseforge"
                  :loader="forge ? 'forge' : fabricLoader ? 'fabric' : ''"
                  :minecraft="minecraft"
                  @install="onInstallCurseforge($event, selected)"
                />
                <ModAddResourceDetail
                  v-else-if="selected.resource"
                  :resources="selected.resource"
                  :loading="adding"
                  :installed="selected.installed"
                  :forge="selected.forge"
                  :fabric="selected.fabric"
                  :quilt="selected.quilt"
                  :loader="forge ? 'forge' : fabricLoader ? 'fabric' : ''"
                  :minecraft="minecraft"
                  :runtime="instance.runtime"
                  @install="onInstallResource($event, selected, selected.installed)"
                />
              </template>
              <Hint
                v-else
                text="Search and select project"
                icon="playlist_add"
              />
            </div>
          </template>
          <template #right>
            <ModAddCartList />
          </template>
        </SplitPane>
      </template>
    </SplitPane>
  </div>
</template>

<script lang=ts setup>
import ErrorView from '@/components/ErrorView.vue'
import Hint from '@/components/Hint.vue'
import SplitPane from '@/components/SplitPane.vue'
import { kInstanceContext } from '@/composables/instanceContext'
import { kInstallList } from '@/composables/installList'
import { ModListSearchItem } from '@/composables/modSearchItems'
import { kCompact } from '@/composables/scrollTop'
import { injection } from '@/util/inject'
import { File } from '@xmcl/curseforge'
import { ProjectVersion } from '@xmcl/modrinth'
import { Resource } from '@xmcl/runtime-api'
import ModAddCartList from './ModAddCartList.vue'
import ModAddCurseforgeDetail from './ModAddCurseforgeDetail.vue'
import ModAddModrinthDetail from './ModAddModrinthDetail.vue'
import ModAddResourceDetail from './ModAddResourceDetail.vue'
import ModAddSearchItem from './ModAddSearchItem.vue'

const { modSearch, modSearchItems, minecraft, fabricLoader, forge, quiltLoader, instance } = injection(kInstanceContext)
const modLoaderFilters = ref([] as string[])
const { tab } = modSearchItems

onMounted(() => {
  const items = [] as string[]
  if (fabricLoader.value) {
    items.push('fabric')
  }
  if (forge.value) {
    items.push('forge')
  }
  if (quiltLoader.value) {
    items.push('quilt')
  }
  modLoaderFilters.value = items
})

const {
  modrinth, modrinthError, loadingModrinth,
  curseforge, curseforgeError, loadingCurseforge,
  loading,
} = modSearch
const { items: searchItems } = modSearchItems
const items = computed(() => {
  const all = searchItems.value
  const allowForge = modLoaderFilters.value.indexOf('forge') !== -1
  const allowFabric = modLoaderFilters.value.indexOf('fabric') !== -1
  const allowQuilt = modLoaderFilters.value.indexOf('quilt') !== -1

  return all.filter(a => (allowForge && a.forge) || (allowFabric && a.fabric) || (allowQuilt && a.quilt) || a.modrinth || a.curseforge || a.divider || a.installed)
})
const counts = computed(() => {
  let installed = 0
  let searched = items.value.length
  for (const item of items.value) {
    if (item.divider) {
      searched -= 1
      break
    }
    installed += 1
    searched -= 1
  }
  return {
    installed,
    searched: searched === 0 ? items.value.length : searched,
  }
})

const selected = ref(undefined as undefined | ModListSearchItem)
const onSelect = (i: ModListSearchItem) => {
  selected.value = i
}
watch(items, (all) => {
  const last = selected.value
  selected.value = all.find(i => i.id === last?.id)
})

const total = computed(() => {
  if (tab.value === 3) {
    return modrinth.value?.total_hits || 0
  }
  if (tab.value === 2) {
    return curseforge.value?.pagination.totalCount || 0
  }
  return 0
})

const { add, addAsRemove } = injection(kInstallList)
const adding = ref(false)

const onInstallResource = async (resource: Resource, item: ModListSearchItem, toRemove?: Resource) => {
  try {
    adding.value = true
    if (!toRemove) {
      await add(resource, { icon: item.icon, uri: item.id, name: item.title })
    } else {
      await add(resource, { icon: item.icon, uri: item.id, name: item.title })
      addAsRemove(toRemove, { icon: item.icon, uri: item.id, name: item.title })
    }
  } finally {
    adding.value = false
  }
}

const onInstallCurseforge = (mod: File, item: ModListSearchItem) => {
  add(mod, { icon: item?.icon, uri: item.id, name: item?.title })
}

const onInstallModrinth = (project: ProjectVersion, item: ModListSearchItem) => {
  add(project, { icon: item.icon, uri: item.id, name: item.title })
}

const onScroll = (e: Event) => {
  const target = e.target as HTMLElement
  if (!target) return
  if (target.scrollTop + target.clientHeight >= target.scrollHeight - 100) {
    if (modSearchItems.tab.value === 2) {
      modSearch.loadMoreCurseforge()
    } else if (modSearchItems.tab.value === 3) {
      modSearch.loadMoreModrinth()
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
