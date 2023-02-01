<template>
  <div class="flex flex-col max-h-full select-none h-full pt-4 pb-0">
    <SharedTooltip />
    <v-progress-linear
      class="absolute top-0 z-10 m-0 p-0 left-0"
      :active="loading"
      height="3"
      :indeterminate="true"
    />

    <ModHeader
      class="mx-8"
      :mod-loader-filters.sync="modLoaderFilters"
      :count="enabledModCounts"
      @install="onInstall"
    />

    <div
      class="flex overflow-auto h-full flex-col py-0 visible-scroll"
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
      <v-virtual-scroll
        v-else
        :class="{ 'selection-mode': isSelectionMode }"
        :items="items"
        :bench="2"
        class="overflow-auto max-h-full"
        item-height="100"
      >
        <template #default="{ item, index }">
          <div class="mx-8 invisible-scroll last:mb-4">
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
import { kSharedTooltip, useSharedTooltip } from '@/composables/sharedTooltip'
import { InstanceServiceKey, ResourceDomain, ResourceServiceKey } from '@xmcl/runtime-api'
import DeleteDialog from '../components/DeleteDialog.vue'
import { ModItem, useInstanceMods } from '../composables/mod'
import ModCard from './ModCard.vue'
import ModDeleteView from './ModDeleteView.vue'
import FloatButton from './ModFloatButton.vue'
import ModHeader from './ModHeader.vue'
import SharedTooltip from '../components/SharedTooltip.vue'
import { CompatibleDetail } from '@/util/modCompatible'
import { usePresence } from '@/composables/presence'

const { importResources } = useService(ResourceServiceKey)
const { items: mods, commit, committing, isModified, enabledModCounts } = useInstanceMods()
const loading = false
const { push } = useRouter()

const onInstall = () => {
  push('/mod-add')
}

provide(kSharedTooltip, useSharedTooltip<CompatibleDetail>((dep) => {
  const compatibleText = dep.compatible === 'maybe'
    ? t('mod.maybeCompatible')
    : dep.compatible
      ? t('mod.compatible')
      : t('mod.incompatible')
  return compatibleText + t('mod.acceptVersion', { version: dep.requirements }) + ', ' + t('mod.currentVersion', { current: dep.version || '⭕' }) + '.'
}))

const filtered = useModFilter(mods)
const { isSelectionMode, selectedItems, onEnable, onClick } = useModSelection(filtered.items)
const { t } = useI18n()

const { onDrop: onDropToImport } = useDrop((file) => {
  importResources([{ path: file.path, domain: ResourceDomain.Mods }])
})

const { isDraggingMod, onDragEnd, onItemDragstart } = useModDragging(filtered.items, selectedItems, isSelectionMode)
const { deletingMods, startDelete, confirmDelete, cancelDelete } = useModDeletion(mods)
const { modLoaderFilters, items } = filtered

const onTags = (item: ModItem, tags: string[]) => {
  item.tags = tags
}
const onSelect = () => {
  isSelectionMode.value = true
}
const { state } = useService(InstanceServiceKey)
usePresence({ location: 'instance-mods', instance: state.instance.name })
</script>
