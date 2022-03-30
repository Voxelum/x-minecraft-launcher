<template>
  <div class="flex flex-col max-h-full select-none h-full px-8 py-4 pb-0 gap-3">
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
      <!-- <v-toolbar-title class="headline self-center pl-2">
        {{ $tc("mod.name", 2) }}
      </v-toolbar-title> -->
      <!-- <v-spacer /> -->
      <filter-combobox
        class="pr-3 max-w-200 max-h-full"
        :label="$t('mod.filter')"
      />
      <!-- <v-tooltip bottom>
      <template v-slot:activator="{ on }">-->
      <div class="flex-grow" />
      <v-btn
        icon
        @click="showModsFolder()"
      >
        <v-icon>folder</v-icon>
      </v-btn>

      <v-tooltip bottom>
        <template #activator="{ on }">
          <v-btn
            icon
            v-on="on"
            @click="goToCurseforgeMods()"
          >
            <v-icon>
              $vuetify.icons.curseforge
            </v-icon>
          </v-btn>
        </template>
        {{ $t(`curseforge.mc-mods.description`) }}
      </v-tooltip>
      <v-tooltip bottom>
        <template #activator="{ on }">
          <v-btn
            icon
            v-on="on"
            @click="goToModrinthPage()"
          >
            <v-icon>
              $vuetify.icons.modrinth
            </v-icon>
          </v-btn>
        </template>
        {{ $t(`modrinth.installFrom`) }}
      </v-tooltip>
      <v-tooltip bottom>
        <template #activator="{ on }">
          <v-btn
            icon
            v-on="on"
            @click="filterInCompatible = !filterInCompatible"
          >
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
    </v-card>

    <div
      class="flex overflow-auto h-full flex-col container py-0"
      @dragend="onDrageEnd"
      @dragover.prevent="onDragOver"
      @drop="onDropToImport"
    >
      <refreshing-tile
        v-if="loading"
        class="h-full"
      />
      <hint
        v-else-if="items.length === 0"
        icon="save_alt"
        :text="$t('mod.dropHint')"
        :absolute="true"
        class="h-full z-0"
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
          v-observe-visibility="
            // @ts-expect-error
            (visible) => onVisible(visible, index)"
          :source="item"
          :selection="isSelectionMode"
          @enable="onEnable"
          @dragstart="onItemDragstart(item)"
          @tags="item.tags = $event"
          @select="item.selected = true"
          @click="onClick($event, index)"
        />
      </transition-group>
      <v-dialog
        :value="deletingMods.length !== 0"
        width="400"
        persistance
        @input="cancelDelete"
      >
        <delete-view
          :confirm="confirmDelete"
          :cancel="cancelDelete"
          :items="deletingMods"
        />
      </v-dialog>
    </div>
    <div class="absolute w-full left-0 bottom-0 flex items-center justify-center mb-5">
      <float-button
        :deleting="isDraggingMod"
        :visible="isDraggingMod || isModified"
        :loading="committing"
        @drop="onDropDelete"
        @click="commit"
      />
    </div>
  </div>
</template>

<script lang=ts>
import { Ref } from '@vue/composition-api'
import FilterCombobox, { useFilterCombobox } from '/@/components/FilterCombobox.vue'
import { useDrop, useService, useOperation, useResourceOperation, useRouter } from '/@/composables'
import { useLocalStorageCacheBool } from '/@/composables/cache'
import { isModCompatible, InstanceServiceKey } from '@xmcl/runtime-api'
import Hint from '/@/components/Hint.vue'
import RefreshingTile from '/@/components/RefreshingTile.vue'
import ModCard from './ModCard.vue'
import DeleteView from './ModDeleteView.vue'
import FloatButton from './ModFloatButton.vue'
import { ModItem, useInstanceMods } from '../composables/mod'
import { useInstanceBase } from '../composables/instance'

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

  function select(start: number, end: number) {
    if (!isSelectionMode.value) {
      isSelectionMode.value = true
    }
    for (let i = start; i < end; ++i) {
      items.value[i].selected = true
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
      select(min + 1, max)
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
    }
  }
  function onKeyDown(e: KeyboardEvent) {
    if ((e.key === 'a') && e.ctrlKey) {
      console.log(`${items.value.length} select`)
      select(0, items.value.length)
      e.preventDefault()
      return false
    }
    return true
  }
  function onEnable({ item, enabled }: { item: ModItem; enabled: boolean }) {
    if (item.selected) {
      selectedItems.value.forEach(i => { i.enabled = enabled })
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

function setupVisibleFilter(items: Ref<ModItem[]>) {
  const visibleCount = ref(30)
  function onVisible(visible: boolean, index: number) {
    if (!visible) {
      // if (visibleCount.value > index + 40) {
      //   visibleCount.value = index + 40
      // }
    } else if (visibleCount.value < index + 20) {
      visibleCount.value += 20
    } else if (visibleCount.value > index + 50) {
      visibleCount.value -= 20
    }
  }
  const mods = computed(() => items.value
    .filter((m, i) => i < visibleCount.value))
  return {
    items: mods,
    visibleCount,
    onVisible,
  }
}

function setupFilter(items: Ref<ModItem[]>) {
  function getFilterOptions(item: ModItem) {
    return [
      { label: 'info', value: item.type, color: 'lime' },
      { value: item.id, color: 'orange en-1' },
      ...item.tags.map(t => ({ type: 'tag', value: t, label: 'label' })),
    ]
  }
  const filterOptions = computed(() => items.value.map(getFilterOptions).reduce((a, b) => [...a, ...b], []))
  const { filter } = useFilterCombobox<ModItem>(filterOptions, getFilterOptions, (v) => `${v.name} ${v.version} ${v.dependencies.minecraft}`)

  const { state } = useService(InstanceServiceKey)
  const runtime = computed(() => state.instance.runtime)

  const filterInCompatible = useLocalStorageCacheBool('ModSettingPage.filterInCompatible', false)

  function isCompatibleMod(mod: ModItem) {
    if (mod.enabled) {
      return true
    }
    if (filterInCompatible.value) {
      return isModCompatible(mod.resource, runtime.value) !== false
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

  const mods = computed(() => filter(items.value)
    .filter(isCompatibleMod)
    .sort((a, b) => (a.enabled ? -1 : 1))
    .reduce(group, []))

  return {
    items: mods,
    filterInCompatible,
  }
}

export default defineComponent({
  components: {
    ModCard,
    DeleteView,
    FloatButton,
    FilterCombobox,
    Hint,
    RefreshingTile: RefreshingTile as any,
  },
  setup() {
    const { importResource } = useResourceOperation()
    const { items: mods, commit, committing, isModified, showDirectory, loading } = useInstanceMods()
    const { path } = useInstanceBase()
    const { push } = useRouter()

    const filtered = setupFilter(mods)
    const visibleFiltered = setupVisibleFilter(filtered.items)
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
    function goToModrinthPage() {
      push(`/modrinth?from=${path.value}`)
    }

    return {
      ...setupDragMod(filtered.items, selectedItems, isSelectionMode),
      ...setupDeletion(mods),
      filterInCompatible: filtered.filterInCompatible,
      ...visibleFiltered,

      showModsFolder: showDirectory,
      goToCurseforgeMods,
      goToModrinthPage,
      onDropToImport,
      onDragOver,
      commit,
      committing,
      isModified,
      loading,
      ModCard,
      ...selection,
    }
  },
})
</script>

<style>
</style>
