<template>
  <div class="flex flex-col max-h-full h-full">
    <div class="header-bar">
      <v-toolbar-title class="headline text-bold">
        {{ $tc('shaderpack.name', 2) }}
      </v-toolbar-title>
      <v-spacer />
      <FilterCombobox
        class="max-w-150 mr-2"
        :label="$t('shaderpack.filter')"
      />
      <v-btn
        icon
        @click="showDirectory()"
      >
        <v-icon>folder</v-icon>
      </v-btn>
    </div>
    <RefreshingTile
      v-if="loading"
      class="h-full"
    />
    <v-container
      v-else
      grid-list-md
      class="flex flex-col overflow-auto max-h-full w-full  py-1 "
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
      <v-dialog
        v-model="isDeleteViewShown"
        width="400"
        persistance
      >
        <DeleteView
          :item="deletingPack"
          :confirm="onConfirmDeleted"
          :cancel="onCancelDelete"
          :deleting="deleting"
        />
      </v-dialog>
    </v-container>
  </div>
</template>

<script lang="ts">
import { computed, defineComponent, Ref, ref } from '@vue/composition-api'
import DeleteButton from './DeleteButton.vue'
import DeleteView from './DeleteView.vue'
import ShaderPackCard from './ShaderPackCard.vue'
import { useRefreshable } from '/@/hooks/useRefreshable'
import { ShaderPackItem, useShaderpacks } from '/@/hooks/useShaderpacks'
import FilterCombobox, { useFilterCombobox } from '/@/components/FilterCombobox.vue'
import RefreshingTile from '/@/components/RefreshingTile.vue'

function setupFilter(items: Ref<ShaderPackItem[]>) {
  const filterOptions = computed(() => items.value.map(getFilterOptions).reduce((a, b) => [...a, ...b], []))
  function getFilterOptions(item: ShaderPackItem) {
    return [
      ...item.tags.map(t => ({ type: 'tag', value: t, label: 'label' })),
    ]
  }
  const { filter } = useFilterCombobox(filterOptions, getFilterOptions, (i) => i.name)
  const result = computed(() => filter(items.value))

  return {
    items: result,
  }
}

export default defineComponent({
  components: { ShaderPackCard, DeleteButton, DeleteView, FilterCombobox, RefreshingTile: RefreshingTile as any },
  setup() {
    const { shaderPacks, selectedShaderPack, removeShaderPack, showDirectory, loading } = useShaderpacks()
    const draggingPack = ref(undefined as undefined | ShaderPackItem)
    const deletingPack = ref(undefined as undefined | ShaderPackItem)
    const isDeleteViewShown = ref(false)

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
        isDeleteViewShown.value = false
      }
    })
    function onCancelDelete() {
      deletingPack.value = undefined
      isDeleteViewShown.value = false
    }
    function onDelete() {
      if (draggingPack.value !== undefined) {
        deletingPack.value = draggingPack.value
        isDeleteViewShown.value = true
      }
    }

    return {
      showDirectory,
      onSelect,
      draggingPack,
      deletingPack,
      isDeleteViewShown,
      deleting,
      loading,

      onDragStart,
      onDragEnd,
      onDelete,
      onConfirmDeleted,
      onCancelDelete,

      ...setupFilter(shaderPacks),
    }
  },
})
</script>
