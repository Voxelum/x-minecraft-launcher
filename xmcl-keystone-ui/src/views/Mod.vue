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
              :runtime="provideRuntime"
              :color="cardColor"
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
import { kColorTheme } from '@/composables/colorTheme'
import { useModDeletion } from '@/composables/modDelete'
import { useModDragging } from '@/composables/modDraggable'
import { useModDropHandler } from '@/composables/modDropHandler'
import { useModFilter } from '@/composables/modFilter'
import { useModSelection } from '@/composables/modSelection'
import { usePresence } from '@/composables/presence'
import { kCompact, useCompactScroll } from '@/composables/scrollTop'
import { injection } from '@/util/inject'
import DeleteDialog from '../components/DeleteDialog.vue'
import { ModItem, useInstanceModItems } from '../composables/instanceModItems'
import ModCard from './ModCard.vue'
import ModDeleteView from './ModDeleteView.vue'
import { kInstance } from '@/composables/instance'
import { kInstanceModsContext } from '@/composables/instanceMods'

const { instance } = injection(kInstance)
const { mods: _mods, provideRuntime, isValidating: loading } = injection(kInstanceModsContext)
const { cardColor } = injection(kColorTheme)
const { items: mods, enableMod, disableMod, updateTag, updating } = useInstanceModItems(instance, _mods)
const filtered = useModFilter(mods)
const { isSelectionMode, selectedItems, onEnable, onClick } = useModSelection(filtered.items, enableMod, disableMod)

const { t } = useI18n()

const { dragover } = useModDropHandler()

const { onDragEnd, onItemDragstart } = useModDragging(filtered.items, selectedItems, isSelectionMode)
const { deletingMods, startDelete, confirmDelete, cancelDelete } = useModDeletion(computed(() => instance.value.path), mods)
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
usePresence(computed(() => t('presence.mod', { instance: instance.value.name })))
</script>
