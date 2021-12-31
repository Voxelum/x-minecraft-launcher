<template>
  <div class="flex flex-col max-h-full">
    <div class="header-bar">
      <v-toolbar-title class="headline text-bold">{{ $tc('shaderpack.name', 2) }}</v-toolbar-title>
      <v-spacer />
      <FilterCombobox class="max-w-150 mr-2" :label="$t('shaderpack.filter')" />
      <v-btn icon @click="showDirectory()">
        <v-icon>folder</v-icon>
      </v-btn>
    </div>
    <v-container grid-list-md @dragover.prevent class="flex flex-col overflow-auto">
      <transition-group
        tag="div"
        name="transition-list"
        class="w-full flex flex-col py-1 overflow-auto max-h-full"
      >
        <ShaderPackCard
          v-for="pack in items"
          :key="pack.value"
          :pack="pack"
          @select="onSelect"
          @dragstart="onDragStart"
          @dragend="onDragEnd"
        ></ShaderPackCard>
      </transition-group>
      <DeleteButton :visible="!!draggingPack" :drop="onDelete" />
      <v-dialog v-model="isDeleteViewShown" width="400" persistance>
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
import { computed, defineComponent, Ref, ref } from '@vue/composition-api';
import DeleteButton from './DeleteButton.vue';
import DeleteView from './DeleteView.vue';
import ShaderPackCard from './ShaderPackCard.vue';
import { useFilterCombobox } from '/@/components/FilterCombobox.vue';
import { useRefreshable } from '/@/hooks/useRefreshable';
import { ShaderPackItem, useShaderpacks } from '/@/hooks/useShaderpacks';
import FilterCombobox from '../../../../components/FilterCombobox.vue';

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
  setup() {
    const { shaderPacks, selectedShaderPack, removeShaderPack, showDirectory } = useShaderpacks()
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

      onDragStart,
      onDragEnd,
      onDelete,
      onConfirmDeleted,
      onCancelDelete,

      ...setupFilter(shaderPacks)
    }
  },
  components: { ShaderPackCard, DeleteButton, DeleteView, FilterCombobox }
})
</script>