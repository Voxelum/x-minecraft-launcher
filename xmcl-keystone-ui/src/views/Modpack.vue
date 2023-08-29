<template>
  <div class="visible-scroll flex h-full max-h-full select-none  flex-col gap-3 pb-0 pl-7">
    <v-progress-linear
      v-show="refreshing"
      class="absolute left-0 top-0 z-10 m-0 p-0"
      height="3"
      :indeterminate="refreshing"
    />
    <v-card
      class="z-5 mr-8 mt-4 flex flex-shrink flex-grow-0 items-center gap-2 rounded-lg p-2"
      outlined
      elevation="1"
    >
      <FilterCombobox
        class="max-w-200 max-h-full pr-3"
        :label="t('modpack.filter')"
      />
      <div class="flex-grow" />
      <v-btn
        icon
        @click="showFolder()"
      >
        <v-icon>folder</v-icon>
      </v-btn>

      <v-tooltip bottom>
        <template #activator="{ on }">
          <v-btn
            icon
            v-on="on"
            @click="goToCurseforge()"
          >
            <v-icon>
              $vuetify.icons.curseforge
            </v-icon>
          </v-btn>
        </template>
        {{ t(`modpack.installFromCurseforge`) }}
      </v-tooltip>
      <v-tooltip bottom>
        <template #activator="{ on }">
          <v-btn
            icon
            v-on="on"
            @click="goToModrinth()"
          >
            <v-icon>
              $vuetify.icons.modrinth
            </v-icon>
          </v-btn>
        </template>
        {{ t(`modpack.installFromModrinth`) }}
      </v-tooltip>
    </v-card>

    <div
      class="container flex h-full flex-col gap-4 overflow-auto overflow-x-hidden py-0"
    >
      <refreshing-tile
        v-if="refreshing"
        class="h-full"
      />
      <template v-for="[group, packs] of Object.entries(grouped)">
        <v-subheader
          :key="group"
        >
          {{ group }}
        </v-subheader>
        <TransitionGroup
          :key="group + 'list'"
          name="transition-list"
          tag="div"
          class="flex w-full flex-grow-0 flex-wrap items-start gap-4"
        >
          <ModpackCard
            v-for="item of packs"
            :key="item.id"
            :item="item"
            @tags="item.tags = $event"
            @dragstart="dragging = item"
            @dragend="dragging = undefined"
            @create="show(item.id)"
            @delete="startDelete(item)"
          />
        </TransitionGroup>
      </template>
      <div
        key="dummy"
        class="min-h-10 min-w-[100vw]"
      />
    </div>
    <DeleteDialog
      :title="t('modpack.delete.title')"
      :width="450"
      persistent
      dialog="delete-modpack"
      @confirm="confirmDelete"
    >
      {{ t('modpack.delete.hint', { name: deleting ? deleting.name : '' }) }}
      <p style="color: grey">
        {{ deleting ? deleting.path : '' }}
      </p>
    </DeleteDialog>
    <div class="absolute bottom-0 mb-10 flex w-full items-center justify-center">
      <DeleteButton
        :visible="!!dragging"
        :drop="onDrop"
      />
    </div>
  </div>
</template>

<script lang=ts setup>
import FilterCombobox from '@/components/FilterCombobox.vue'
import { useFilterCombobox, useService } from '@/composables'
import { kModpacks } from '@/composables/modpack'
import { kMarketRoute } from '@/composables/useMarketRoute'
import { isStringArrayEquals } from '@/util/equal'
import { injection } from '@/util/inject'
import { CachedFTBModpackVersionManifest, ModpackServiceKey, Resource, ResourceServiceKey } from '@xmcl/runtime-api'
import { Ref } from 'vue'
import DeleteDialog from '../components/DeleteDialog.vue'
import { useDialog } from '../composables/dialog'
import { useFeedTheBeastVersionsCache } from '../composables/ftb'
import { AddInstanceDialogKey } from '../composables/instanceTemplates'
import { ModpackItem } from '../composables/modpack'
import ModpackCard from './ModpackCard.vue'
import DeleteButton from './ModpackDeleteButton.vue'

const { t } = useI18n()
const dragging = ref(undefined as undefined | ModpackItem)
const { removeResources, updateResources } = useService(ResourceServiceKey)
const { showModpacksFolder } = useService(ModpackServiceKey)
const items: Ref<ModpackItem[]> = ref([])
const { show } = useDialog(AddInstanceDialogKey)
function getFilterOptions(item: ModpackItem) {
  return [
    { label: 'info', value: item.type, color: 'lime' },
    ...item.tags.map(t => ({ type: 'tag', value: t, label: 'label' })),
  ]
}
const deleting = ref(undefined as undefined | Resource)
const { refreshing, resources } = injection(kModpacks)
const filterOptions = computed(() => items.value.map(getFilterOptions).reduce((a, b) => [...a, ...b], []))
const { filter } = useFilterCombobox(filterOptions, getFilterOptions, (v) => `${v.name} ${v.author} ${v.version}`)
const { cache: ftb, dispose } = useFeedTheBeastVersionsCache()
const modpacks = computed(() => filter(items.value))
const grouped = computed(() => {
  const result: Record<string, ModpackItem[]> = {}
  for (const p of modpacks.value) {
    if (!result[p.name]) result[p.name] = []
    result[p.name].push(p)
  }
  for (const v of Object.values(result)) {
    v.sort((a, b) => (b.resource?.storedDate || 0) - (a.resource?.storedDate || 0))
  }
  return result
})

function showFolder() {
  showModpacksFolder()
}
const { show: showDelete } = useDialog('delete-modpack')
function startDelete(item: ModpackItem) {
  if (item.resource) {
    deleting.value = item.resource
    showDelete()
  }
}
function confirmDelete() {
  removeResources([deleting.value!.hash])
}
function onDrop() {
  if (dragging.value) {
    startDelete(dragging.value)
  }
}
const { goToCurseforge, goToModrinth } = injection(kMarketRoute)

function getModpackItem (resource: Resource): ModpackItem {
  const metadata = resource.metadata
  return reactive({
    resource,
    id: resource.path,
    size: resource.size,
    icon: resource.icons ? resource.icons[0] : '',
    name: metadata['curseforge-modpack']?.name ?? metadata['mcbbs-modpack']?.name ?? metadata['modrinth-modpack']?.name ?? '',
    version: metadata['curseforge-modpack']?.version ?? metadata['modrinth-modpack']?.versionId ?? metadata['mcbbs-modpack']?.version ?? '',
    author: metadata['curseforge-modpack']?.author ?? metadata['mcbbs-modpack']?.author ?? '',
    tags: [...resource.tags],
    type: metadata.modpack ? 'raw' : (metadata['curseforge-modpack'] ? 'curseforge' : 'modrinth'),
  })
}
function getModpackItemByFtb(resource: CachedFTBModpackVersionManifest): ModpackItem {
  return reactive({
    ftb: resource,
    id: `${resource.parent}-${resource.id}`,
    size: resource.files.map(f => f.size).reduce((a, b) => a + b, 0),
    icon: resource.iconUrl,
    name: resource.projectName,
    version: resource.name,
    author: resource.authors[0].name,
    tags: [],
    type: 'ftb',
  })
}
onMounted(async () => {
  items.value = [...resources.value.map(getModpackItem), ...ftb.value.map(getModpackItemByFtb)].sort((a, b) => a.name.localeCompare(b.name))
})
onUnmounted(() => {
  const editedResources = items.value
    .filter(i => !!i.resource)
    .filter(i => !isStringArrayEquals(i.tags, i.resource!.tags))
  updateResources(editedResources.map(i => ({
    hash: i.resource!.hash,
    name: i.name,
    tags: i.tags,
  })))
  dispose()
})
watch(resources, (v) => {
  items.value = [...v.map(getModpackItem), ...ftb.value.map(getModpackItemByFtb)]
})
</script>
