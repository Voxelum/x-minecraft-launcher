<template>
  <v-tab-item class="h-full flex-col gap-4 overflow-auto overflow-x-hidden py-0">
    <RefreshingTile
      v-if="refreshing"
      class="h-full"
    />
    <v-virtual-scroll
      id="left-pane"
      :bench="2"
      class="visible-scroll ml-2 h-full max-h-full overflow-auto"
      :items="modpacks"
      :item-height="62"
    >
      <template #default="{ item }">
        <ModpackListItem
          :key="item.id"
          :item="item"
          @tags="item.tags = $event"
          @create="onCreate(item)"
          @delete="startDelete(item)"
        />
      </template>
    </v-virtual-scroll>
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
  </v-tab-item>
</template>

<script lang=ts setup>
import ModpackListItem from '@/components/ModpackListItem.vue'
import RefreshingTile from '@/components/RefreshingTile.vue'
import { useFilterCombobox, useService } from '@/composables'
import { useModpacks } from '@/composables/modpack'
import { isStringArrayEquals } from '@/util/equal'
import { CachedFTBModpackVersionManifest, Resource, ResourceServiceKey } from '@xmcl/runtime-api'
import { Ref } from 'vue'
import DeleteDialog from '../components/DeleteDialog.vue'
import { useDialog } from '../composables/dialog'
import { useFeedTheBeastVersionsCache } from '../composables/ftb'
import { AddInstanceDialogKey } from '../composables/instanceTemplates'
import { ModpackItem } from '../composables/modpack'

const { t } = useI18n()
const { removeResources, updateResources } = useService(ResourceServiceKey)
const items: Ref<ModpackItem[]> = ref([])
const { show } = useDialog(AddInstanceDialogKey)
const deleting = ref(undefined as undefined | Resource)
const { refreshing, resources } = useModpacks()
function getFilterOptions(item: ModpackItem) {
  return [
    { label: 'info', value: item.type, color: 'lime' },
    ...item.tags.map(t => ({ type: 'tag', value: t, label: 'label' })),
  ]
}
const filterOptions = computed(() => items.value.map(getFilterOptions).reduce((a, b) => [...a, ...b], []))
const { filter } = useFilterCombobox(filterOptions, getFilterOptions, (v) => `${v.name} ${v.author} ${v.version}`)
const { cache: ftb, dispose } = useFeedTheBeastVersionsCache()
const modpacks = computed(() => filter(items.value))
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

const onCreate = (item: ModpackItem) => {
  if (item.resource) {
    show({ type: 'resource', resource: item.resource })
  } else if (item.ftb) {
    show({ type: 'ftb', manifest: item.ftb })
  }
}
</script>
