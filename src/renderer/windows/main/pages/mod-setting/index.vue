<template>
  <div class="flex flex-col max-h-full">
    <div class="header-bar">
      <v-toolbar-title class="headline self-center pl-2">{{ $tc("mod.name", 2) }}</v-toolbar-title>
      <v-spacer />
      <v-combobox
        ref="searchElem"
        v-model="filteredItems"
        :items="filterOptions"
        :label="$t('mod.filter')"
        class="pr-3 max-w-200 max-h-full"
        :search-input.sync="filteredText"
        chips
        clearable
        hide-details
        :allow-overflow="true"
        prepend-inner-icon="filter_list"
        multiple
        solo
        @click:clear="clearFilterItems"
      >
        <template v-slot:item="{ index, item, tile }">
          <v-list-tile-action>
            <v-checkbox :value="tile.props.value" hide-details />
          </v-list-tile-action>
          <v-chip label outline :color="item.color ? item.color : 'pink'">
            <v-icon left>{{ item.label ? item.label : 'label' }}</v-icon>
            {{ item.value }}
          </v-chip>
        </template>
        <template v-slot:selection="{ index, item, selected }">
          <v-chip
            label
            outline
            :color="item.color ? item.color : 'pink'"
            :selected="selected"
            close
            @input="removeFilteredItem(index)"
          >
            <v-icon left v-if="item.label">{{ item.label }}</v-icon>
            <!-- <v-icon left v-else>filter_list</v-icon> -->
            {{ item.value }}
          </v-chip>
        </template>
      </v-combobox>
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
import { computed, defineComponent, nextTick, onMounted, onUnmounted, ref, Ref, watch } from '@vue/composition-api'
import { filter } from 'fuzzy'
import { onSearchToggle } from '../../hooks'
import DeleteView from './DeleteView.vue'
import FloatButton from './FloatButton.vue'
import ModCard from './ModCard.vue'
import { ModItem, useInstanceMods } from './useInstanceMod'
import {
  useDrop,
  useInstanceBase, useInstanceVersionBase, useOperation, useResourceOperation, useRouter,
  useService
} from '/@/hooks'
import { useLocalStorageCacheBool } from '/@/hooks/useCache'
import { isCompatible } from '/@shared/entities/version'
import { BaseServiceKey } from '/@shared/services/BaseService'

function setupDragMod(items: Ref<ModItem[]>, selectedMods: Ref<ModItem[]>, isSelectionMode: Ref<boolean>) {
  const isDraggingMod = computed(() => items.value.some(i => i.dragged))

  function onItemDragstart(mod: ModItem) {
    if (isSelectionMode.value && selectedMods.value.some(m => m.id === mod.id)) {
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

interface FilterItem {
  type: string
  label?: string
  value: string
  color?: string
}

function setupFilter(items: Ref<ModItem[]>, minecraft: Ref<string>) {
  const filteredText = ref('')
  const filteredItems = ref([] as Array<FilterItem | string>)
  const visibleCount = ref(10)
  const filterInCompatible = useLocalStorageCacheBool('ModSettingPage.filterInCompatible', false)
  const filterOptions = computed(() => {
    const result = [] as FilterItem[]
    for (const item of items.value) {
      result.unshift({ label: 'info', type: 'tag', value: item.type, color: 'lime' }, { type: 'tag', value: item.id, color: 'orange darken-1' })
      result.push(...[...new Set<string>(item.tags)].map(s => ({ type: 'tag', value: s, label: 'label' })))
    }
    return result
  })

  watch(filteredItems, (newItems, oldItems) => {
    if (newItems.length === oldItems.length) { return }
    if (typeof newItems[newItems.length - 1] === 'string') {
      filteredItems.value = newItems.filter(v => typeof v === 'string' || (typeof v === 'object' && v.type !== 'keyword')).map(v => {
        if (typeof v === 'string') {
          return { type: 'keyword', value: v }
        }
        return v
      })
    }
  })

  function isCompatibleMod(mod: ModItem) {
    if (mod.enabled) {
      return true
    }
    if (filterInCompatible.value) {
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
  function isValidItem(item: ModItem) {
    for (const tag of filteredItems.value) {
      if (typeof tag === 'object') {
        if (tag.type === 'tag') {
          const match = item.tags.some(t => t === tag.value) || item.id === tag.value || item.type === tag.value
          if (!match) {
            return false
          }
        }
      }
    }
    return true
  }
  const mods = computed(() => {
    const filteringOn = filteredText.value ? filteredText.value : (filteredItems.value.find(i => typeof i === 'object' && i.type === 'keyword') as any)?.value as string | undefined
    const baseItems = filteringOn
      ? filter(filteringOn, items.value, { extract: v => `${v.name} ${v.version} ${v.dependencies.minecraft}` }).map((r) => r.original ? r.original : r as any as ModItem)
      : items.value
    return baseItems
      .filter(isValidItem)
      .filter(isCompatibleMod)
      .sort((a, b) => (a.enabled ? -1 : 1))
      .reduce(group, [])
      .filter((m, i) => i < visibleCount.value)
  })

  function onVisible(visible: boolean, index: number) {
    if (!visible) return
    if (visibleCount.value < index + 20) {
      visibleCount.value += 20
    }
  }
  function removeFilteredItem(index: number) {
    filteredItems.value = filteredItems.value.filter((v, i) => i !== index)
  }
  function clearFilterItems() {
    filteredItems.value = []
  }

  return {
    filteredItems,
    filterOptions,
    onVisible,
    items: mods,
    filteredText,
    filterInCompatible,
    removeFilteredItem,
    clearFilterItems,
  }
}

export default defineComponent({
  components: {
    ModCard,
    DeleteView,
    FloatButton,
  },
  setup() {
    const { minecraft } = useInstanceVersionBase()
    const { importResource } = useResourceOperation()
    const { items: mods, commit, committing, isModified, showDirectory } = useInstanceMods()
    const searchElem = ref(null as null | any)
    const { path } = useInstanceBase()
    const { openDirectory } = useService(BaseServiceKey)
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
    onSearchToggle(() => {
      if (searchElem.value) {
        searchElem.value.focus()
      }
      return true
    })

    onMounted(() => {
      (searchElem.value!.$el as HTMLElement).addEventListener('focus', (e) => {
        console.log('focus')
        const keyword = filtered.filteredItems.value.find(v => typeof v === 'object' && v.type !== 'keyword')
        filtered.filteredItems.value = filtered.filteredItems.value.filter(v => typeof v === 'object' && v.type !== 'keyword')
        if (keyword && typeof keyword === 'object') {
          filtered.filteredText.value = keyword.value
        }
      })
    })

    return {
      ...setupDragMod(filtered.items, selectedItems, isSelectionMode),
      ...setupDeletion(mods),
      ...filtered,
      searchElem,

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
