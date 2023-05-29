<template>
  <div class="resource-pack-page">
    <v-progress-linear
      class="absolute left-0 top-0 z-10 m-0 p-0"
      :active="refreshing || isValidating"
      height="3"
      :indeterminate="true"
    />
    <v-card
      color="transparent"
      flat
      class="list invisible-scroll"
      @dragover.prevent
      @drop="onDropToSide(false, dragging)"
    >
      <v-subheader class="list-title">
        {{
          t("resourcepack.unselected")
        }}
      </v-subheader>
      <Hint
        v-if="unselectedItems.length === 0 || isValidating"
        v-dragover
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
          :key="item.resourcePack.path"
          :pack="item"
          :minecraft="minecraft"
          :is-selected="false"
          @tags="item.tags = $event"
          @dragstart="startDragging(item)"
          @dragend="stopDragging()"
          @mouseup="stopDragging()"
          @drop="onDropToCard(false, item, dragging); stopDragging()"
        />
      </TransitionGroup>
    </v-card>

    <v-card
      color="transparent"
      flat
      class="list invisible-scroll"
      @dragover.prevent
      @drop="onDropToSide(true, dragging)"
    >
      <v-subheader class="list-title">
        {{
          t("resourcepack.selected")
        }}
      </v-subheader>
      <Hint
        v-if="selectedItems.length === 0 || isValidating"
        v-dragover
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
            :key="item.resourcePack.path"
            :pack="item"
            :minecraft="minecraft"
            :is-selected="true"
            @delete="startDelete(item)"
            @dragstart="startDragging(item)"
            @dragend="stopDragging()"
            @mouseup="stopDragging()"
            @drop="onDropToCard(true, item, dragging); stopDragging()"
          />
        </template>
      </TransitionGroup>
    </v-card>

    <v-fab-transition>
      <div class="item-center absolute bottom-5 flex w-full justify-center">
        <v-btn
          v-if="dragging"
          class="bottom-3"
          large
          fab
          bottom
          color="error"
          @dragover.prevent
          @drop="onDropDeleteButton"
        >
          <v-icon>delete</v-icon>
        </v-btn>
      </div>
    </v-fab-transition>
    <DeleteDialog
      :title="t('resourcepack.deletion', { pack: deletingPack ? deletingPack.name : '' })"
      :width="400"
      persistent
      @cancel="stopDelete()"
      @confirm="confirmDeletingPack"
    >
      <div>{{ t("resourcepack.deletionHint") }}</div>
      <span class="text-gray-500">
        {{ deletingPack ? deletingPack.resourcePack.resource ? deletingPack.resourcePack.resource.path : '' : '' }}
      </span>
    </DeleteDialog>
  </div>
</template>

<script lang=ts setup>
import Hint from '@/components/Hint.vue'
import { useFilterCombobox, useService } from '@/composables'
import { kInstance } from '@/composables/instance'
import { kInstanceResourcePacks } from '@/composables/instanceResourcePack'
import { ResourcePackItem, useInstanceResourcePackItem } from '@/composables/instanceResourcePackItem'
import { kInstanceVersion } from '@/composables/instanceVersion'
import { usePresence } from '@/composables/presence'
import { kCompact } from '@/composables/scrollTop'
import { vDragover } from '@/directives/dragover'
import { injection } from '@/util/inject'
import { ResourceServiceKey } from '@xmcl/runtime-api'
import { Ref, computed, ref } from 'vue'
import DeleteDialog from '../components/DeleteDialog.vue'
import { useDialog } from '../composables/dialog'
import ResourcePackCard from './ResourcePackCard.vue'
import { kInstanceOptions } from '@/composables/instanceOptions'

function setupFilter(disabled: Ref<ResourcePackItem[]>, enabled: Ref<ResourcePackItem[]>) {
  function getFilterOptions(item: ResourcePackItem) {
    return [
      ...item.tags.map(t => ({ type: 'tag', value: t, label: 'label' })),
    ]
  }
  const filterOptions = computed(() => disabled.value.map(getFilterOptions).concat(enabled.value.map(getFilterOptions)).reduce((a, b) => [...a, ...b], []))
  const { filter } = useFilterCombobox(filterOptions, getFilterOptions, (i) => `${i.name} ${i.resourcePack.description}`)
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

const { path } = injection(kInstance)
const { minecraft } = injection(kInstanceVersion)
const { isValidating } = injection(kInstanceOptions)
const { refreshing, enabled: enabled_, disabled: disabled_ } = injection(kInstanceResourcePacks)
const { enabled, disabled, enable, disable } = useInstanceResourcePackItem(path, minecraft, enabled_, disabled_)
const { t } = useI18n()
const { show } = useDialog('deletion')

// Dragging pack
const dragging = ref(undefined as ResourcePackItem | undefined)
function stopDragging() {
  dragging.value = undefined
}
function startDragging(item: ResourcePackItem) {
  dragging.value = item
}

// Drop to card or side
function onDropToCard(right: boolean, target: ResourcePackItem, item: ResourcePackItem | undefined) {
  if (!item) return
  if (right) {
    // Enable the pack
    enable(item, target)
  } else {
    disable(item, target)
  }
}
function onDropToSide(right: boolean, item: ResourcePackItem | undefined) {
  if (!item) return
  if (right) {
    // Enable the pack
    enable(item)
  } else {
    disable(item)
  }
}

const { unselectedItems, selectedItems, filterOptions } = setupFilter(computed(() => disabled.value), computed(() => enabled.value))

// Delete
const { removeResources } = useService(ResourceServiceKey)
const deletingPack = ref(undefined as ResourcePackItem | undefined)
async function confirmDeletingPack() {
  removeResources([deletingPack.value!.resourcePack.id])
  deletingPack.value = undefined
}
function startDelete(item: ResourcePackItem) {
  deletingPack.value = item
  show()
}
function stopDelete() {
  deletingPack.value = undefined
}
function onDropDeleteButton() {
  if (dragging.value && !enabled.value.includes(dragging.value)) {
    startDelete(dragging.value)
  }
}

const { push } = useRouter()
function goPreview() {
  push('/resource-pack-preview')
}

const { name } = injection(kInstance)
usePresence(computed(() => t('presence.resourcePack', { instance: name.value })))
</script>

<style scoped>
.resource-pack-page {
  @apply flex flex-col h-full grid grid-cols-2 lg:(gap-8 px-8) px-4 gap-3 pb-4 relative overflow-x-hidden overflow-y-auto;
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

.dragover {
  @apply border-4 border-dashed border-yellow-400;
}

.transition-list {
  @apply overflow-auto flex flex-col gap-1.5 p-1;
}
</style>
