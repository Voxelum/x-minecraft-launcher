<template>
  <div class="flex flex-col max-h-full">
    <div class="header-bar">
      <v-toolbar-title class="headline self-center pl-2">{{ $tc("mod.name", 2) }}</v-toolbar-title>
      <v-spacer />
      <filter-combobox class="pr-3 max-w-200 max-h-full" :label="$t('mod.filter')" />
      <!-- <v-tooltip bottom>
      <template v-slot:activator="{ on }">-->
      <v-btn icon @click="showModsFolder()">
        <v-icon>folder</v-icon>
      </v-btn>
      <!-- </template>
        {{ $t(`curseforge.mc-mods.description`) }}
      </v-tooltip>-->
      <v-tooltip bottom>
        <template #activator="{ on }">
          <v-btn icon v-on="on" @click="goToCurseforgeMods()">
            <v-icon :size="14">$vuetify.icons.curseforge</v-icon>
          </v-btn>
        </template>
        {{ $t(`curseforge.mc-mods.description`) }}
      </v-tooltip>
      <v-tooltip bottom>
        <template #activator="{ on }">
          <v-btn icon v-on="on" @click="filterInCompatible = !filterInCompatible">
            <v-icon>
              {{
                filterInCompatible ? "visibility" : "visibility_off"
              }}
            </v-icon>
          </v-btn>
        </template>
        {{
          filterInCompatible
            ? $t("mod.showIncompatible")
            : $t("mod.hideIncompatible")
        }}
      </v-tooltip>
    </div>
    <v-container
      fill-height
      class="flex overflow-auto h-full flex-col"
      @dragend="onDrageEnd"
      @dragover.prevent="onDragOver"
      @drop="onDropToImport"
    >
      <hint
        v-if="items.length === 0"
        icon="save_alt"
        :text="$t('mod.dropHint')"
        :absolute="true"
        class="h-full"
      />
      <transition-group
        v-else
        name="transition-list"
        tag="div"
        class="flex flex-col overflow-auto h-full w-full"
        :class="{ 'selection-mode': isSelectionMode }"
      >
        <mod-card
          v-for="(item, index) in items"
          :key="item.hash"
          :mod="item"
          :selection="isSelectionMode"
          v-observe-visibility="(visible) => onVisible(visible, index)"
          @enable="onEnable"
          @dragstart="onItemDragstart(item)"
          @select="select(item)"
          @click="onClick($event, index)"
        />
      </transition-group>
      <float-button
        :deleting="isDraggingMod"
        :visible="isDraggingMod || isModified"
        :loading="committing"
        @drop="onDropDelete"
        @click="commit"
      />
      <v-dialog :value="deletingMods.length !== 0" width="400" persistance @input="cancelDelete">
        <delete-view :confirm="confirmDelete" :cancel="cancelDelete" :items="deletingMods" />
      </v-dialog>
    </v-container>
  </div>
</template>

<script lang=ts>
import { computed, defineComponent, nextTick, onMounted, onUnmounted, ref, Ref } from '@vue/composition-api'
import DeleteView from './DeleteView.vue'
import FloatButton from './FloatButton.vue'
import ModCard from './ModCard.vue'
import { ModItem, useInstanceMods } from './useInstanceMod'
import { useFilterCombobox } from '/@/components/FilterCombobox.vue'
import {
  useDrop,
  useInstanceBase, useInstanceVersionBase, useOperation, useResourceOperation, useRouter
} from '/@/hooks'
import { useLocalStorageCacheBool } from '/@/hooks/useCache'
import { isCompatible } from '/@shared/entities/version'
import FilterCombobox from '../../../../components/FilterCombobox.vue'

function setupDragMod(items: Ref<ModItem[]>, selectedMods: Ref<ModItem[]>, isSelectionMode: Ref<boolean>) {
  const isDraggingMod = computed(() => items.value.some(i => i.dragged))

  function onItemDragstart(mod: ModItem) {
    if (isSelectionMode.value && mod.selected) {
      for (const item of selectedMods.value) {
        item.dragged = true
      }
    } else {
      mod.dragged = true
    }
  }
  function onDrageEnd() {
    for (const item of items.value) {
      item.dragged = false
    }
  }
  return {
    isDraggingMod,
    onDrageEnd,
    onItemDragstart,
  }
}

function setupDeletion(items: Ref<ModItem[]>) {
  const { removeResource } = useResourceOperation()
  const { begin: beginDelete, cancel: cancelDelete, operate: confirmDelete, data: deletingMods } = useOperation<ModItem[]>([], (mods) => {
    for (const mod of mods) {
      removeResource(mod.hash)
    }
  })
  function onDropDelete(e: DragEvent) {
    beginDelete(items.value.filter(i => i.dragged))
  }
  return {
    deletingMods,
    onDropDelete,
    confirmDelete,
    cancelDelete,
  }
}

function setupSelection(items: Ref<ModItem[]>) {
  const isSelectionMode = ref(false)
  const selectedItems = computed(() => items.value.filter(i => i.selected))

  function select(...mod: ModItem[]) {
    if (!isSelectionMode.value) {
      isSelectionMode.value = true
    }
    for (const m of mod) {
      m.selected = true
    }
  }
  function selectOrUnselect(mod: ModItem) {
    if (isSelectionMode.value) {
      mod.selected = !mod.selected
    }
  }
  let lastIndex = -1
  function onClick(event: MouseEvent, index: number) {
    if (lastIndex !== -1 && event.shiftKey) {
      let min = lastIndex
      let max = index
      if (lastIndex > index) {
        max = lastIndex
        min = index
      }
      select(...items.value.slice(min + 1, max))
    }
    selectOrUnselect(items.value[index])
    lastIndex = index
  }
  function onKeyup(e: KeyboardEvent) {
    if (e.key === 'Escape') {
      isSelectionMode.value = false
      for (const item of items.value) {
        item.selected = false
      }
    } else if ((e.keyCode === 65 || e.key === 'a') && e.ctrlKey) {
      isSelectionMode.value = true
      nextTick().then(() => select(...items.value))
    }
  }
  function onKeyDown(e: KeyboardEvent) {
    if ((e.keyCode === 65 || e.key === 'a') && e.ctrlKey) {
      e.preventDefault()
      return false
    }
    return true
  }
  function onEnable({ item, enabled }: { item: ModItem, enabled: boolean }) {
    if (item.selected) {
      selectedItems.value.forEach(i => i.enabled = enabled)
    } else {
      item.enabled = enabled
    }
  }
  onMounted(() => {
    document.addEventListener('keydown', onKeyDown)
    document.addEventListener('keyup', onKeyup)
  })
  onUnmounted(() => {
    document.removeEventListener('keydown', onKeyDown)
    document.removeEventListener('keyup', onKeyup)
  })
  return {
    selectedItems,
    onEnable,
    onClick,
    select,
    isSelectionMode,
  }
}

function setupFilter(items: Ref<ModItem[]>, minecraft: Ref<string>) {
  function getFilterOptions(item: ModItem) {
    return [
      { label: 'info', value: item.type, color: 'lime' },
      { value: item.id, color: 'orange darken-1' },
      ...item.tags.map(t => ({ type: 'tag', value: t, label: 'label' })),
    ]
  }
  const filterOptions = computed(() => items.value.map(getFilterOptions).reduce((a, b) => [...a, ...b], []))
  const { filter } = useFilterCombobox<ModItem>(filterOptions, getFilterOptions, (v) => `${v.name} ${v.version} ${v.dependencies.minecraft}`)

  const visibleCount = ref(10)
  const filterInCompatible = useLocalStorageCacheBool('ModSettingPage.filterInCompatible', false)

  function isCompatibleMod(mod: ModItem) {
    if (mod.enabled) {
      return true
    }
    if (filterInCompatible.value) {
      console.log(`${mod.id} ${mod.type} ${mod.path} ${mod.dependencies.minecraft} ${minecraft.value}`)
      return isCompatible(mod.dependencies.minecraft, minecraft.value)
    }
    return true
  }
  function group(list: ModItem[], mod: ModItem): ModItem[] {
    if (list.find(v => v.hash === mod.hash)) return list
    const existed = list.findIndex(v => v.id === mod.id && v.type === mod.type)
    if (existed !== -1) {
      list.splice(existed + 1, 0, mod)
      mod.subsequence = true
    } else {
      list.push(mod)
      mod.subsequence = false
    }
    return list
  }
  function onVisible(visible: boolean, index: number) {
    if (!visible) return
    if (visibleCount.value < index + 20) {
      visibleCount.value += 20
    }
  }
  const mods = computed(() => filter(items.value)
    .filter(isCompatibleMod)
    .sort((a, b) => (a.enabled ? -1 : 1))
    .reduce(group, [])
    .filter((m, i) => i < visibleCount.value))

  return {
    items: mods,
    filterInCompatible,
    onVisible,
  }
}

export default defineComponent({
  components: {
    ModCard,
    DeleteView,
    FloatButton,
    FilterCombobox
  },
  setup() {
    const { minecraft } = useInstanceVersionBase()
    const { importResource } = useResourceOperation()
    const { items: mods, commit, committing, isModified, showDirectory } = useInstanceMods()
    const { path } = useInstanceBase()
    const { push } = useRouter()

    const filtered = setupFilter(mods, minecraft)
    const selection = setupSelection(filtered.items)
    const { isSelectionMode, selectedItems } = selection

    const { onDrop: onDropToImport } = useDrop((file) => {
      importResource({ type: 'mods', path: file.path })
    })

    function onDragOver(event: DragEvent) {
      // console.log(event);
    }
    function goToCurseforgeMods() {
      push(`/curseforge/mc-mods?from=${path.value}`)
    }

    return {
      ...setupDragMod(filtered.items, selectedItems, isSelectionMode),
      ...setupDeletion(mods),
      ...filtered,

      showModsFolder: showDirectory,
      goToCurseforgeMods,
      onDropToImport,
      onDragOver,
      commit,
      committing,
      isModified,
      ModCard,
      ...selection,
    }
  },
})
</script>

<style>
</style>
