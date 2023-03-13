<template>
  <div class="resource-pack-page">
    <v-progress-linear
      class="absolute top-0 z-10 m-0 p-0 left-0"
      :active="loading"
      height="3"
      :indeterminate="true"
    />
    <!-- {{ t("resourcepack.name", 2) }} -->
    <!-- t('resourcepack.filter') -->
    <!-- <v-btn
        @click="goPreview"
      >
        <span class="material-icons-outlined icon-image-preview">
          preview
        </span>
    </v-btn>-->

    <v-card
      ref="leftList"
      class="h-full overflow-y-auto invisible-scroll flex flex-col"
      @drop="stopDragging()"
    >
      <v-card-title class="justify-center sticky top-0 z-10">
        {{
          t("resourcepack.unselected")
        }}
      </v-card-title>
      <Hint
        v-if="unselectedItems.length === 0"
        icon="save_alt"
        :text="
          t('resourcepack.dropHint')"
        class="h-full"
      />
      <TransitionGroup
        v-else
        class="overflow-auto flex flex-col gap-1.5"
        name="transition-list"
        tag="div"
      >
        <ResourcePackCard
          v-for="item in unselectedItems"
          :key="item.path"
          :pack="item"
          :is-selected="false"
          @tags="item.tags = $event"
          @dragstart="startDragging()"
          @dragend="stopDragging()"
          @mouseup="stopDragging()"
        />
      </TransitionGroup>
    </v-card>

    <v-card
      ref="rightList"
      class="h-full overflow-y-auto invisible-scroll flex flex-col"
      @drop="stopDragging()"
    >
      <v-card-title class="w-full justify-center sticky top-0 z-10">
        {{
          t("resourcepack.selected")
        }}
      </v-card-title>
      <Hint
        v-if="selectedItems.length === 0"
        icon="save_alt"
        :text="t('resourcepack.dropHint')"
        class="h-full"
      />
      <TransitionGroup
        v-else
        name="transition-list"
        tag="div"
        class="overflow-auto flex flex-col gap-1.5"
      >
        <template
          v-for="item in selectedItems"
        >
          <ResourcePackCard
            :key="item.path"
            :pack="item"
            :is-selected="true"
            @delete="startDelete(item)"
            @dragstart="startDragging()"
            @dragend="stopDragging()"
            @mouseup="stopDragging()"
          />
        </template>
      </TransitionGroup>
    </v-card>

    <v-fab-transition>
      <v-btn
        v-if="data.dragging"
        style="right: 40vw; bottom: 10px"
        large
        absolute

        fab
        bottom
        color="error"
        @dragover.prevent
        @drop="onDropDelete"
      >
        <v-icon>delete</v-icon>
      </v-btn>
    </v-fab-transition>
    <DeleteDialog
      :title="t('resourcepack.deletion', { pack: data.deletingPack ? data.deletingPack.name : '' })"
      :width="400"
      persistent
      @cancel="stopDelete()"
      @confirm="confirmDeletingPack"
    >
      <div>{{ t("resourcepack.deletionHint") }}</div>
      <span class="text-gray-500">
        {{ data.deletingPack ? data.deletingPack.resource ? data.deletingPack.resource.path : '' : '' }}
      </span>
    </DeleteDialog>
  </div>
</template>

<script lang=ts setup>
import { computed, onUnmounted, reactive, ref, Ref } from 'vue'
import { InstanceServiceKey, ResourceDomain, ResourceServiceKey } from '@xmcl/runtime-api'
import DeleteDialog from '../components/DeleteDialog.vue'
import { useDialog } from '../composables/dialog'
import { useInstanceBase } from '../composables/instance'
import { ResourcePackItem, useInstanceResourcePacks } from '../composables/resourcePack'
import ResourcePackCard from './ResourcePackCard.vue'
import FilterCombobox from '@/components/FilterCombobox.vue'
import Hint from '@/components/Hint.vue'
import { useDragTransferList, useDropImport, useFilterCombobox, useService, useServiceBusy } from '@/composables'
import { usePresence } from '@/composables/presence'
import { kCompact } from '@/composables/scrollTop'
import { injection } from '@/util/inject'

const is = ref([1, 2, 3, 4, 5])

function setupFilter(disabled: Ref<ResourcePackItem[]>, enabled: Ref<ResourcePackItem[]>) {
  function getFilterOptions(item: ResourcePackItem) {
    return [
      ...item.tags.map(t => ({ type: 'tag', value: t, label: 'label' })),
    ]
  }
  const filterOptions = computed(() => disabled.value.map(getFilterOptions).concat(enabled.value.map(getFilterOptions)).reduce((a, b) => [...a, ...b], []))
  const { filter } = useFilterCombobox(filterOptions, getFilterOptions, (i) => `${i.name} ${i.description}`)
  const selectedItems = computed(() => filter(enabled.value))
  const unselectedItems = computed(() => filter(disabled.value))

  return {
    filterOptions,
    selectedItems,
    unselectedItems,
  }
}

const compact = injection(kCompact)
onMounted(() => {
  compact.value = true
})

const filterText = ref('')
const rightList: Ref<any> = ref(null)
const leftList: Ref<any> = ref(null)
const { enabled, disabled, add, remove, commit, insert, showDirectory, loading } = useInstanceResourcePacks()
const { removeResources } = useService(ResourceServiceKey)
const { push } = useRouter()
const { path } = useInstanceBase()
const { t } = useI18n()
const data = reactive({
  dragging: false,
  deletingPack: null as ResourcePackItem | null,
})
const { show } = useDialog('deletion')
const leftListElem = computed(() => leftList.value.$el) as Ref<HTMLElement>
const rightListElem = computed(() => rightList.value.$el) as Ref<HTMLElement>
useDragTransferList(
  leftListElem,
  rightListElem,
  insert,
  add,
  remove,
)
useDropImport(leftListElem, ResourceDomain.ResourcePacks)
useDropImport(rightListElem, ResourceDomain.ResourcePacks)

onUnmounted(commit)

function stopDragging() {
  data.dragging = false
}

function startDragging() {
  data.dragging = true
}

function filterName(r: ResourcePackItem) {
  if (!filterText.value) return true
  return r.name.toLowerCase().indexOf(filterText.value.toLowerCase()) !== -1
}

const { unselectedItems, selectedItems, filterOptions } = setupFilter(computed(() => disabled.value), computed(() => enabled.value))

async function confirmDeletingPack() {
  removeResources([data.deletingPack!.id])
  data.deletingPack = null
}

function startDelete(item: ResourcePackItem) {
  data.deletingPack = item
  show()
}

function stopDelete() {
  data.deletingPack = null
}

function onDropDelete(e: DragEvent) {
  const url = e.dataTransfer!.getData('id')
  const target = enabled.value.find(m => m.id === url) ?? disabled.value.find(m => m.id === url) ?? null
  if (target) {
    startDelete(target)
  }
}
function goPreview() {
  push('/resource-pack-preview')
}
function goToCurseforge() {
  push(`/curseforge/texture-packs?from=${path.value}`)
}

const { state } = useService(InstanceServiceKey)
usePresence({ location: 'instance-resourcepacks', instance: state.instance.name })
</script>

<style scoped>
.resource-pack-page {
  @apply flex flex-col overflow-auto h-full grid grid-cols-2 lg:(gap-8 px-8) px-4 gap-3 pb-4;
}
</style>
