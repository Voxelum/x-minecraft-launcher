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
        <div class="flex flex-grow-0 pl-4 items-center pr-4">
          <v-subheader class="pl-0 py-2">
            <v-icon left>
              travel_explore
            </v-icon>
            Search Result
            <v-divider
              vertical
              class="mx-2"
            />
            <span>
              {{ items.length }} items
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
        >
          <template #default="{ item }">
            <ModAddSearchItem
              :item="item"
              :selected="(selected && selected.id === item.id ) || false"
              @click="onSelect(item)"
            />
          </template>
        </v-virtual-scroll>
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
              <template v-if="!!selected">
                <ModAddModrinthDetail
                  v-if="selected.modrinth"
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
                  :forge="selected.forge"
                  :fabric="selected.fabric"
                  :quilt="selected.quilt"
                  :loader="forge ? 'forge' : fabricLoader ? 'fabric' : ''"
                  :minecraft="minecraft"
                  @install="onInstallResource($event, selected)"
                />
              </template>
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
import SplitPane from '@/components/SplitPane.vue'
import { kInstanceContext } from '@/composables/instanceContext'
import { kModInstallList } from '@/composables/modInstallList'
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

const { modSearch, modSearchItems, minecraft, fabricLoader, forge, quiltLoader } = injection(kInstanceContext)
const modLoaderFilters = ref([] as string[])

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
  mods,
  keyword,
} = modSearch
const { items: searchItems } = modSearchItems
const items = computed(() => {
  const all = searchItems.value
  const allowForge = modLoaderFilters.value.indexOf('forge') !== -1
  const allowFabric = modLoaderFilters.value.indexOf('fabric') !== -1
  const allowQuilt = modLoaderFilters.value.indexOf('quilt') !== -1

  return all.filter(a => (allowForge && a.forge) || (allowFabric && a.fabric) || (allowQuilt && a.quilt))
})

const selected = ref(undefined as undefined | ModListSearchItem)
const onSelect = (i: ModListSearchItem) => {
  selected.value = i
}

const { add } = injection(kModInstallList)

const onInstallResource = (resource: Resource, item?: ModListSearchItem) => {
  add(resource, { icon: item?.icon, name: item?.title })
}

const onInstallCurseforge = (mod: File, item?: ModListSearchItem) => {
  add(mod, { icon: item?.icon, name: item?.title })
}

const onInstallModrinth = (project: ProjectVersion, item?: ModListSearchItem) => {
  add(project, { icon: item?.icon, name: item?.title })
}

const { t } = useI18n()
const compact = injection(kCompact)
onMounted(() => {
  compact.value = true
})
</script>
