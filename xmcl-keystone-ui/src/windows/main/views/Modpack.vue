<template>
  <div class="flex flex-col max-h-full select-none h-full px-8 py-4 pb-0 gap-3">
    <v-progress-linear
      v-show="refreshing"
      class="absolute top-0 z-10 m-0 p-0 left-0"
      height="3"
      :indeterminate="refreshing"
    />
    <v-card
      class="flex py-1 rounded-lg flex-shrink flex-grow-0 items-center pr-2 gap-2 z-5"
      outlined
      elevation="1"
    >
      <filter-combobox
        class="pr-3 max-w-200 max-h-full"
        :label="t('modpack.filter')"
      />
      <!-- <v-tooltip bottom>
      <template v-slot:activator="{ on }">-->
      <div class="flex-grow" />
      <v-btn
        icon
        @click="showFolder()"
      >
        <v-icon>folder</v-icon>
      </v-btn>

      <!-- </template>
        {{ t(`curseforge.mc-mods.description`) }}
      </v-tooltip>-->
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
        {{ t(`curseforge.modpacks.description`) }}
      </v-tooltip>
    </v-card>

    <div
      class="flex overflow-auto h-full flex-col container py-0"
    >
      <refreshing-tile
        v-if="refreshing"
        class="h-full"
      />
      <!-- <hint
        v-else-if="modpacks.length === 0"
        icon="save_alt"
        :text="t('modpack.dropHint')"
        :absolute="true"
        class="h-full z-0"
      /> -->
      <transition-group
        name="transition-list"
        tag="div"
        class="flex flex-wrap overflow-auto h-full w-full gap-4 items-start"
      >
        <modpack-card
          v-for="(item) in modpacks"
          :key="item.id"
          :item="item"
          @tags="item.tags = $event"
          @dragstart="dragging = item"
          @dragend="dragging = undefined"
          @create="show(item.resource.path)"
          @delete="startDelete(item)"
        />
      </transition-group>
    </div>
    <delete-dialog
      :title="t('modpack.delete.title')"
      :width="450"
      persistent
      @confirm="confirmDelete"
    >
      {{ t('modpack.delete.hint', { name: deleting ? deleting.resource.name : '' }) }}
      <p style="color: grey">
        {{ deleting ? deleting.resource.path : '' }}
      </p>
    </delete-dialog>
    <div class="absolute w-full bottom-0 flex items-center justify-center mb-10">
      <delete-button
        :visible="!!dragging"
        :drop="onDrop"
      />
    </div>
  </div>
</template>

<script lang=ts setup>
import { Ref } from '@vue/composition-api'
import FilterCombobox from '/@/components/FilterCombobox.vue'
import { useService, useRouter, useBusy, useFilterCombobox, useI18n } from '/@/composables'
import { ResourceServiceKey, ResourceType } from '@xmcl/runtime-api'
import { isStringArrayEquals } from '/@/util/equal'
import ModpackCard from './ModpackCard.vue'
import { AddInstanceDialogKey } from './AppAddInstanceDialog.vue'
import DeleteButton from './ModpackDeleteButton.vue'
import { useDialog } from '../composables/dialog'
import DeleteDialog from '../components/DeleteDialog.vue'
import { ModpackItem, ModpackResources } from '../composables/modpack'

const { t } = useI18n()
const { push } = useRouter()
const dragging = ref(undefined as undefined | ModpackItem)
const { state, removeResource, updateResource } = useService(ResourceServiceKey)
const items: Ref<ModpackItem[]> = ref([])
const { show } = useDialog(AddInstanceDialogKey)
function getFilterOptions(item: ModpackItem) {
  return [
    { label: 'info', value: item.type, color: 'lime' },
    ...item.tags.map(t => ({ type: 'tag', value: t, label: 'label' })),
  ]
}
const deleting = ref(undefined as undefined | ModpackItem)
const refreshing = useBusy('loadDomain(modpacks:resource)')
const filterOptions = computed(() => items.value.map(getFilterOptions).reduce((a, b) => [...a, ...b], []))
const { filter } = useFilterCombobox(filterOptions, getFilterOptions, (v) => `${v.name} ${v.author} ${v.version}`)
const { show: showDelete } = useDialog('deletion')

function showFolder() {

}
function getModpackItem (resource: ModpackResources): ModpackItem {
  return reactive({
    resource,
    id: resource.hash,
    size: resource.size,
    icon: resource.iconUri,
    name: resource.type === ResourceType.CurseforgeModpack || resource.type === ResourceType.McbbsModpack ? resource.metadata.name : '',
    version: resource.type === ResourceType.CurseforgeModpack || resource.type === ResourceType.McbbsModpack ? resource.metadata.version : '',
    author: resource.type === ResourceType.CurseforgeModpack || resource.type === ResourceType.McbbsModpack ? resource.metadata.author : '',
    tags: [...resource.tags],
    type: resource.type === ResourceType.Modpack ? 'raw' : resource.type === ResourceType.CurseforgeModpack ? 'curseforge' : 'modrinth',
  })
}
function onDrop() {
  if (dragging.value) {
    startDelete(dragging.value)
  }
}
function startDelete(item: ModpackItem) {
  deleting.value = item
  showDelete()
}
function confirmDelete() {
  removeResource(deleting.value!.resource.path)
}

const goToCurseforge = () => { push('/curseforge/modpacks') }
const modpacks = computed(() => filter(items.value))
onMounted(() => {
  items.value = state.modpacks.map(getModpackItem)
})
onUnmounted(() => {
  const editedResources = items.value.filter(i => !isStringArrayEquals(i.tags, i.resource.tags))
  const promises: Promise<any>[] = []
  for (const i of editedResources) {
    promises.push(updateResource({
      resource: i.resource.hash,
      name: i.name,
      tags: i.tags,
    }))
  }
})
watch(computed(() => state.modpacks), () => {
  items.value = state.modpacks.map(getModpackItem)
})
</script>

<style>
</style>
