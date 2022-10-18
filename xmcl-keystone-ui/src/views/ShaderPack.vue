<template>
  <div class="flex flex-col max-h-full h-full px-8 py-4">
    <v-progress-linear
      class="absolute top-0 z-10 m-0 p-0 left-0"
      :active="loading"
      height="3"
      :indeterminate="true"
    />
    <v-card
      class="flex py-1 rounded-lg flex-shrink flex-grow-0 items-center pr-2 gap-2 z-5"
      outlined
      elevation="1"
    >
      <!-- <v-toolbar-title class="headline text-bold">
        {{ t('shaderPack.name', 2) }}
      </v-toolbar-title> -->
      <FilterCombobox
        class="max-w-150 mr-2"
        :label="t('shaderPack.filter')"
      />
      <v-spacer />
      <v-btn
        icon
        @click="showDirectory()"
      >
        <v-icon>folder</v-icon>
      </v-btn>
    </v-card>
    <div
      class="flex overflow-auto h-full flex-col px-3"
      @dragover.prevent
    >
      <transition-group
        name="transition-list"
      >
        <ShaderPackCard
          v-for="pack in items"
          :key="pack.value"
          :pack="pack"
          @select="onSelect"
          @dragstart="onDragStart"
          @dragend="onDragEnd"
          @enable="pack.enabled = $event"
          @update:name="pack.name = $event"
          @tags="pack.tags = $event"
        />
      </transition-group>
      <DeleteButton
        :visible="!!draggingPack"
        :drop="onDelete"
      />
      <DeleteDialog
        :title="t('shaderPack.deletion') "
        :width="400"
        persistent
        @confirm="onConfirmDeleted"
        @cancel="onCancelDelete"
      >
        <div
          style="overflow: hidden; word-break: break-all;"
        >
          {{ t('shaderPack.deletionHint', { path: deletingPack ? deletingPack.path : '' }) }}
        </div>
      </DeleteDialog>
    </div>
  </div>
</template>

<script lang="ts" setup>
import { useRefreshable } from '@/composables/refreshable'
import FilterCombobox from '@/components/FilterCombobox.vue'
import { ShaderPackItem, useShaderpacks } from '../composables/shaderpack'
import DeleteButton from './ShaderPackDeleteButton.vue'
import ShaderPackCard from './ShaderPackCard.vue'
import { useFilterCombobox } from '@/composables'
import DeleteDialog from '../components/DeleteDialog.vue'
import { useDialog } from '../composables/dialog'

const { shaderPacks, selectedShaderPack, removeShaderPack, showDirectory, loading } = useShaderpacks()
const draggingPack = ref(undefined as undefined | ShaderPackItem)
const deletingPack = ref(undefined as undefined | ShaderPackItem)
const { show } = useDialog('deletion')
const { t } = useI18n()

function onSelect(pack: ShaderPackItem) {
  selectedShaderPack.value = pack.value
}
function onDragStart(pack: ShaderPackItem) {
  if (pack.enabled) return
  if (!pack.path) return
  draggingPack.value = pack
}
function onDragEnd() {
  draggingPack.value = undefined
}
const { refresh: onConfirmDeleted, refreshing: deleting } = useRefreshable(async () => {
  if (deletingPack.value) {
    await removeShaderPack(deletingPack.value)
    deletingPack.value = undefined
  }
})
function onCancelDelete() {
  deletingPack.value = undefined
}
function onDelete() {
  if (draggingPack.value !== undefined) {
    deletingPack.value = draggingPack.value
    show()
  }
}

const filterOptions = computed(() => shaderPacks.value.map(getFilterOptions).reduce((a, b) => [...a, ...b], []))
function getFilterOptions(item: ShaderPackItem) {
  return [
    ...item.tags.map(t => ({ type: 'tag', value: t, label: 'label' })),
  ]
}
const { filter } = useFilterCombobox(filterOptions, getFilterOptions, (i) => i.name)
const items = computed(() => filter(shaderPacks.value))

</script>
