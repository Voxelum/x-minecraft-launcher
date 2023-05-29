<template>
  <div class="flex flex-col pb-4 mx-5">
    <v-progress-linear
      class="absolute top-0 z-10 m-0 p-0 left-0"
      :active="loading"
      height="3"
      :indeterminate="true"
    />
    <div
      class="flex h-full flex-col px-3"
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
import { useFilterCombobox } from '@/composables'
import { kInstance } from '@/composables/instance'
import { usePresence } from '@/composables/presence'
import { useRefreshable } from '@/composables/refreshable'
import { injection } from '@/util/inject'
import DeleteDialog from '../components/DeleteDialog.vue'
import { useDialog } from '../composables/dialog'
import { ShaderPackItem, useShaderpacks } from '../composables/shaderpack'
import ShaderPackCard from './ShaderPackCard.vue'
import DeleteButton from './ShaderPackDeleteButton.vue'

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

const { name } = injection(kInstance)
usePresence(computed(() => t('presence.shaderPack', { instance: name.value })))
</script>
