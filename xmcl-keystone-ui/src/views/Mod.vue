<template>
  <div class="flex flex-col max-h-full select-none h-full px-8 py-4 pb-0">
    <ModTooltip />
    <v-progress-linear
      class="absolute top-0 z-10 m-0 p-0 left-0"
      :active="loading"
      height="3"
      :indeterminate="true"
    />

    <ModHeader
      :mod-loader-filters.sync="modLoaderFilters"
      :count="enabledModCounts"
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
        :absolute="true"
        class="h-full z-0"
      />
      <div
        v-else
        class="flex flex-col overflow-auto h-full w-full"
        :class="{ 'selection-mode': isSelectionMode }"
      >
        <ModCard
          v-for="(item, index) in items"
          :key="item.hash"
          v-observe-visibility="
            // @ts-expect-error
            (visible) => onVisible(visible, index)"
          :source="item"
          :selection="isSelectionMode"
          @enable="onEnable"
          @dragstart="onItemDragstart(item)"
          @tags="item.tags = $event"
          @select="isSelectionMode = true;"
          @click="onClick($event, index)"
          @delete="startDelete(item)"
        />
        <div
          key="dummy"
          class="min-h-10"
        />
      </div>
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
import { kSharedTooltip, useSharedTooltip } from '@/composables/sharedTooltip'
import { useModVisibleFilter } from '@/composables/modVisibility'
import { ResourceDomain, ResourceServiceKey } from '@xmcl/runtime-api'
import DeleteDialog from '../components/DeleteDialog.vue'
import { useInstanceMods } from '../composables/mod'
import ModCard from './ModCard.vue'
import ModDeleteView from './ModDeleteView.vue'
import FloatButton from './ModFloatButton.vue'
import ModHeader from './ModHeader.vue'
import ModTooltip from '../components/SharedTooltip.vue'
import { CompatibleDetail } from '@/util/modCompatible'

const { importResources } = useService(ResourceServiceKey)
const { items: mods, commit, committing, isModified, loading, enabledModCounts } = useInstanceMods()

provide(kSharedTooltip, useSharedTooltip<CompatibleDetail>((dep) => {
  const compatibleText = dep.compatible === 'maybe'
    ? t('mod.maybeCompatible')
    : dep.compatible
      ? t('mod.compatible')
      : t('mod.incompatible')
  return compatibleText + t('mod.acceptVersion', { version: dep.requirements }) + ', ' + t('mod.currentVersion', { current: dep.version || '⭕' }) + '.'
}))

const filtered = useModFilter(mods)
const visibleFiltered = useModVisibleFilter(filtered.items)
const selection = useModSelection(filtered.items)
const { isSelectionMode, selectedItems, onEnable, onClick } = selection
const { t } = useI18n()

const { onDrop: onDropToImport } = useDrop((file) => {
  importResources([{ path: file.path, domain: ResourceDomain.Mods }])
})

const { isDraggingMod, onDragEnd, onItemDragstart } = useModDragging(filtered.items, selectedItems, isSelectionMode)
const { deletingMods, startDelete, confirmDelete, cancelDelete } = useModDeletion(mods)
const { onVisible, items } = visibleFiltered
const { modLoaderFilters } = filtered
</script>
