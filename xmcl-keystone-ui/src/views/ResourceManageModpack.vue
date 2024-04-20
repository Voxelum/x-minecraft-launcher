<template>
  <div class="h-full select-text flex-col gap-4 overflow-auto overflow-x-hidden py-0">
    <v-data-table
      :items="items"
      :loading="refreshing"
      :headers="headers"
      :items-per-page="10"
    >
      <template #item.name="{ item }">
        <div class="flex items-center gap-2">
          <v-img
            :src="item.icon"
            class="max-w-10 rounded"
          />
          {{ item.name }}
        </div>
      </template>
      <template #item.actions="{ item }">
        <v-btn
          v-if="item.resource"
          icon
          @click="showItemInDirectory(item.resource.path)"
        >
          <v-icon>
            folder
          </v-icon>
        </v-btn>
        <v-btn
          icon
          @click="onCreate(item)"
        >
          <v-icon>
            add
          </v-icon>
        </v-btn>
        <v-btn
          icon
          @click="show(item.resource || item.ftb)"
        >
          <v-icon color="red">
            delete
          </v-icon>
        </v-btn>
      </template>

      <template #footer.prepend>
        <div class="ml-2 flex items-center gap-2">
          <v-btn
            icon
            :loading="refreshing"
          >
            <v-icon>
              folder
            </v-icon>
          </v-btn>
        </div>
      </template>
    </v-data-table>
    <SimpleDialog
      v-model="model"
      :title="t('modpack.delete.title')"
      :width="450"
      persistent
      @confirm="confirm"
    >
      {{ t('modpack.delete.hint', { name: deleting ? deleting.name : '' }) }}
      <p style="color: grey">
        {{ deleting ? 'path' in deleting ? deleting.path : deleting.name : '' }}
      </p>
    </SimpleDialog>
  </div>
</template>

<script lang=ts setup>
import { useService } from '@/composables'
import { AddInstanceDialogKey } from '@/composables/instanceTemplates'
import { useModpacks } from '@/composables/modpack'
import { isStringArrayEquals } from '@/util/equal'
import { getExpectedSize } from '@/util/size'
import { BaseServiceKey, CachedFTBModpackVersionManifest, Resource, ResourceServiceKey } from '@xmcl/runtime-api'
import { Ref } from 'vue'
import SimpleDialog from '../components/SimpleDialog.vue'
import { useDialog, useSimpleDialog } from '../composables/dialog'
import { useFeedTheBeastVersionsCache } from '../composables/ftb'
import { ModpackItem } from '../composables/modpack'

const { t } = useI18n()
const { removeResources, updateResources } = useService(ResourceServiceKey)
const { showItemInDirectory } = useService(BaseServiceKey)
const { show, model, confirm, target: deleting } = useSimpleDialog<undefined | Resource | CachedFTBModpackVersionManifest>((v) => {
  if (!v) return
  if ('path' in v) {
    removeResources([v.hash])
  } else {
    ftb.value = ftb.value.filter(f => f.id !== v.id)
  }
})

const headers = computed(() => [
  {
    text: t('modpack.name'),
    sortable: true,
    value: 'name',
  },
  {
    text: t('modpack.author'),
    sortable: true,
    value: 'author',
  },
  {
    text: t('modpack.modpackVersion'),
    sortable: true,
    value: 'version',
  },
  {
    text: t('fileDetail.fileSize'),
    sortable: true,
    value: 'size',
  },
  // {
  //   text: 'Date',
  //   value: 'date',
  //   sortable: true,
  // },
  {
    text: '',
    value: 'actions',
    sortable: false,
  },
])
const { refreshing, resources } = useModpacks()
const { cache: ftb, dispose } = useFeedTheBeastVersionsCache()

function getModpackItem(resource: Resource): ModpackItem {
  const metadata = resource.metadata
  return ({
    resource,
    id: resource.path,
    size: getExpectedSize(resource.size),
    icon: resource.icons ? resource.icons[0] : '',
    name: metadata['curseforge-modpack']?.name ?? metadata['mcbbs-modpack']?.name ?? metadata['modrinth-modpack']?.name ?? '',
    version: metadata['curseforge-modpack']?.version ?? metadata['modrinth-modpack']?.versionId ?? metadata['mcbbs-modpack']?.version ?? '',
    author: metadata['curseforge-modpack']?.author ?? metadata['mcbbs-modpack']?.author ?? '',
    tags: [...resource.tags],
    type: metadata.modpack ? 'raw' : (metadata['curseforge-modpack'] ? 'curseforge' : 'modrinth'),
  })
}
function getModpackItemByFtb(resource: CachedFTBModpackVersionManifest): ModpackItem {
  return ({
    ftb: resource,
    id: `${resource.parent}-${resource.id}`,
    size: '',
    icon: resource.iconUrl,
    name: resource.projectName,
    version: resource.name,
    author: resource.authors[0].name,
    tags: [],
    type: 'ftb',
  })
}
const items: Ref<ModpackItem[]> = computed(() => [...resources.value.map(getModpackItem), ...ftb.value.map(getModpackItemByFtb)].sort((a, b) => a.name.localeCompare(b.name)))
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

const { show: showCreateDialog } = useDialog(AddInstanceDialogKey)
const onCreate = (item: ModpackItem) => {
  if (item.resource) {
    showCreateDialog({ type: 'resource', resource: item.resource })
  } else if (item.ftb) {
    showCreateDialog({ type: 'ftb', manifest: item.ftb })
  }
}
</script>
