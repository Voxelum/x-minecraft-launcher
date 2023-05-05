<template>
  <div
    class="flex flex-col absolute top-0 left-0 max-h-full h-full w-full transition-all"
    :class="{
      'pt-35': compact,
      'pt-47': !compact,
    }"
  >
    <v-progress-linear
      class="absolute top-0 z-10 m-0 p-0 left-0"
      :active="loading"
      height="3"
      :indeterminate="true"
    />

    <div
      class="flex overflow-auto h-full flex-col py-0"
      @dragend="onDragEnd"
      @dragover.prevent
      @drop="onDropToImport"
    >
      <Hint
        v-if="items.length === 0 || dragover"
        icon="save_alt"
        :text="t('mod.dropHint')"
        class="h-full w-full z-0"
      />
      <v-virtual-scroll
        v-else
        :class="{ 'selection-mode': isSelectionMode }"
        :items="items"
        :bench="2"
        class="overflow-auto max-h-full visible-scroll"
        item-height="100"
        @wheel.native="onScroll"
      >
        <template #default="{ item, index }">
          <div class="mx-5 invisible-scroll last:mb-4">
            <ModCard
              :key="item.path + '@' + item.hash"
              :item="item"
              :index="index"
              :selection="isSelectionMode"
              :on-enable="onEnable"
              :on-tags="onTags"
              :on-select="onSelect"
              :on-item-dragstart="onItemDragstart"
              :on-click="onClick"
              :on-delete="startDelete"
            />
          </div>
        </template>
      </v-virtual-scroll>
      <DeleteDialog
        :width="400"
        persistent
        :title="t('mod.deletion')"
        @cancel="cancelDelete()"
        @confirm="confirmDelete()"
      >
        <ModDeleteView :items="deletingMods" />
      </DeleteDialog>
    </div>
  </div>
</template>

<script lang=ts setup>
import Hint from '@/components/Hint.vue'
import RefreshingTile from '@/components/RefreshingTile.vue'
import { useDrop, useService } from '@/composables'
import { kInstanceContext } from '@/composables/instanceContext'
import { useModDeletion } from '@/composables/modDelete'
import { useModDragging } from '@/composables/modDraggable'
import { useModDropHandler } from '@/composables/modDropHandler'
import { useModFilter } from '@/composables/modFilter'
import { useModSelection } from '@/composables/modSelection'
import { usePresence } from '@/composables/presence'
import { kCompact, useCompactScroll } from '@/composables/scrollTop'
import { injection } from '@/util/inject'
import { InstanceServiceKey, ResourceDomain, ResourceServiceKey } from '@xmcl/runtime-api'
import DeleteDialog from '../components/DeleteDialog.vue'
import { ModItem } from '../composables/mod'
import ModCard from './ModCard.vue'
import ModDeleteView from './ModDeleteView.vue'

const { importResources } = useService(ResourceServiceKey)
const { mods: { items: mods, updating, updateTag, enableMod, disableMod } } = injection(kInstanceContext)
const filtered = useModFilter(mods)
const { isSelectionMode, selectedItems, onEnable, onClick } = useModSelection(filtered.items, enableMod, disableMod)
const { t } = useI18n()

const importing = ref(false)
const { onDrop: onDropToImport } = useDrop((file) => {
  importing.value = true
  importResources([{ path: file.path, domain: ResourceDomain.Mods }]).finally(() => {
    importing.value = false
  })
})

const loading = computed(() => updating.value || importing.value)

const { dragover } = useModDropHandler()

const { isDraggingMod, onDragEnd, onItemDragstart } = useModDragging(filtered.items, selectedItems, isSelectionMode)
const { deletingMods, startDelete, confirmDelete, cancelDelete } = useModDeletion(mods)
const { items } = filtered
const compact = injection(kCompact)
const onScroll = useCompactScroll(compact)

const onTags = (item: ModItem, tags: string[]) => {
  item.tags = tags
  updateTag(item)
}
const onSelect = () => {
  isSelectionMode.value = true
}
const { state } = useService(InstanceServiceKey)
usePresence(computed(() => t('presence.mod', { instance: state.instance.name })))
</script>
