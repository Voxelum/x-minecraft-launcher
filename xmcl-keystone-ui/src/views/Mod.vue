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
      <RefreshingTile
        v-if="loading"
        class="h-full"
      />
      <Hint
        v-else-if="items.length === 0"
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
    <div class="absolute w-full left-0 bottom-0 flex items-center justify-center mb-5 pointer-events-none">
      <FloatButton
        class="pointer-events-auto"
        :deleting="isDraggingMod"
        :visible="isDraggingMod || isModified"
        :loading="committing"
        @drop="startDelete()"
        @click="commit"
      />
    </div>
  </div>
</template>

<script lang=ts setup>
import Hint from '@/components/Hint.vue'
import RefreshingTile from '@/components/RefreshingTile.vue'
import { useDrop, useService } from '@/composables'
import { useModDeletion } from '@/composables/modDelete'
import { useModDragging } from '@/composables/modDraggable'
import { useModFilter } from '@/composables/modFilter'
import { useModSelection } from '@/composables/modSelection'
import { usePresence } from '@/composables/presence'
import { kCompact, useCompactScroll } from '@/composables/scrollTop'
import { injection } from '@/util/inject'
import { InstanceServiceKey, ResourceDomain, ResourceServiceKey } from '@xmcl/runtime-api'
import DeleteDialog from '../components/DeleteDialog.vue'
import { ModItem, useInstanceMods } from '../composables/mod'
import ModCard from './ModCard.vue'
import ModDeleteView from './ModDeleteView.vue'
import FloatButton from './ModFloatButton.vue'

const { importResources } = useService(ResourceServiceKey)
const { items: mods, commit, committing, isModified, enabledModCounts } = useInstanceMods()
const loading = false
const filtered = useModFilter(mods)
const { isSelectionMode, selectedItems, onEnable, onClick } = useModSelection(filtered.items)
const { t } = useI18n()

const { onDrop: onDropToImport } = useDrop((file) => {
  importResources([{ path: file.path, domain: ResourceDomain.Mods }])
})

const { isDraggingMod, onDragEnd, onItemDragstart } = useModDragging(filtered.items, selectedItems, isSelectionMode)
const { deletingMods, startDelete, confirmDelete, cancelDelete } = useModDeletion(mods)
const { modLoaderFilters, items } = filtered
const compact = injection(kCompact)
const onScroll = useCompactScroll(compact)

const onTags = (item: ModItem, tags: string[]) => {
  item.tags = tags
}
const onSelect = () => {
  isSelectionMode.value = true
}
const { state } = useService(InstanceServiceKey)
usePresence({ location: 'instance-mods', instance: state.instance.name })
</script>
