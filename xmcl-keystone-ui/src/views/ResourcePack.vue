<template>
  <div class="resource-pack-page">
    <v-progress-linear
      class="absolute top-0 z-10 m-0 p-0 left-0"
      :active="loading"
      height="3"
      :indeterminate="true"
    />
    <v-card
      ref="leftList"
      color="transparent"
      flat
      class="list invisible-scroll"
      @drop="stopDragging()"
    >
      <v-subheader class="list-title">
        {{
          t("resourcepack.unselected")
        }}
      </v-subheader>
      <Hint
        v-if="unselectedItems.length === 0"
        icon="save_alt"
        :text="
          t('resourcepack.dropHint')"
        class="h-full"
      />
      <TransitionGroup
        v-else
        class="transition-list"
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
      color="transparent"
      flat
      class="list invisible-scroll"
      @drop="stopDragging()"
    >
      <v-subheader class="list-title">
        {{
          t("resourcepack.selected")
        }}
      </v-subheader>
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
        class="transition-list"
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
import Hint from '@/components/Hint.vue'
import { useDragTransferList, useDropImport, useFilterCombobox, useService } from '@/composables'
import { kInstanceContext } from '@/composables/instanceContext'
import { usePresence } from '@/composables/presence'
import { kCompact } from '@/composables/scrollTop'
import { injection } from '@/util/inject'
import { ResourceDomain, ResourceServiceKey } from '@xmcl/runtime-api'
import { Ref, computed, onUnmounted, reactive, ref } from 'vue'
import DeleteDialog from '../components/DeleteDialog.vue'
import { useDialog } from '../composables/dialog'
import { ResourcePackItem, useInstanceResourcePacks } from '../composables/resourcePack'
import ResourcePackCard from './ResourcePackCard.vue'

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

watch(compact, (c) => {
  if (!c) {
    compact.value = true
  }
})

const filterText = ref('')
const rightList: Ref<any> = ref(null)
const leftList: Ref<any> = ref(null)
const { enabled, disabled, add, remove, commit, insert, showDirectory, loading } = useInstanceResourcePacks()
const { removeResources } = useService(ResourceServiceKey)
const { push } = useRouter()
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

const { name } = injection(kInstanceContext)
usePresence(computed(() => t('presence.resourcePack', { instance: name.value })))
</script>

<style scoped>
.resource-pack-page {
  @apply flex flex-col overflow-auto h-full grid grid-cols-2 lg:(gap-8 px-8) px-4 gap-3 pb-4;
}

.list-title {
  @apply w-full sticky top-0 z-10 flex-shrink-0 pl-0;
  text-transform: uppercase;
  text-indent: 0.0892857143em;
  letter-spacing: .0892857143em;
}

.list {
  @apply h-full overflow-y-auto flex flex-col;
}

.transition-list {
  @apply overflow-auto flex flex-col gap-1.5 p-1;
}
</style>
