<template>
  <div class="flex flex-col max-h-full">
    <div class="header-bar">
      <v-toolbar-title class="headline text-bold">{{ $tc('shaderpack.name', 2) }}</v-toolbar-title>
      <v-spacer />
      <v-combobox
        v-model="filteredItems"
        :items="filterOptions"
        class="max-w-150"
        :label="$t('shaderpack.filter')"
        :search-input.sync="searchText"
        chips
        clearable
        hide-details
        :overflow="true"
        prepend-inner-icon="filter_list"
        multiple
        solo
      ></v-combobox>
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
import { filter } from 'fuzzy';
import DeleteButton from './DeleteButton.vue';
import DeleteView from './DeleteView.vue';
import ShaderPackCard from './ShaderPackCard.vue';
import { useRefreshable } from '/@/hooks/useRefreshable';
import { ShaderPackItem, useShaderpacks } from '/@/hooks/useShaderpacks';

function setupFilter(items: Ref<ShaderPackItem[]>) {
  const searchText = ref('')
  const filteredItems = ref([] as string[])
  const visibleCount = ref(10)
  const filterOptions = computed(() => items.value.map(m => m.tags).reduce((a, b) => [...a, ...b], []))

  const result = computed(() =>
    filter(searchText.value, items.value, { extract: v => `${v.name}` })
      .map((r) => r.original ? r.original : r as any as ShaderPackItem)
      .filter(i => filteredItems.value.length > 0 ? i.tags.some(t => filteredItems.value.indexOf(t) !== -1) || filteredItems.value.indexOf(i.name) !== -1 : true)
      .filter((m, i) => i < visibleCount.value))

  function onVisible(visible: boolean, index: number) {
    if (!visible) return
    if (visibleCount.value < index + 20) {
      visibleCount.value += 20
    }
  }

  return {
    filteredItems,
    filterOptions,
    onVisible,
    items: result,
    searchText,
  }
}

export default defineComponent({
  setup() {
    const { shaderPacks, selectedShaderPack, removeShaderPack } = useShaderpacks()
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
      shaderPacks,
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
  components: { ShaderPackCard, DeleteButton, DeleteView }
})
</script>