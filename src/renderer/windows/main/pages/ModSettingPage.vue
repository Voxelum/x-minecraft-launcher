<template>
  <v-container
    fill-height
    style="overflow: auto"
    @dragend="onDrageEnd"
    @dragover.prevent="onDragOver"
    @drop="onDropToImport"
  >
    <v-layout
      column
      fill-height
      style="max-height: 100%"
    >
      <v-toolbar
        dark
        flat
        color="transparent"
        style="z-index: 10"
      >
        <v-toolbar-title>{{ $tc("mod.name", 2) }}</v-toolbar-title>
        <v-spacer />
        <!-- <v-tooltip bottom>
          <template v-slot:activator="{ on }"> -->
        <v-btn
          icon
          @click="showModsFolder()"
        >
          <v-icon>folder</v-icon>
        </v-btn>
        <!-- </template>
          {{ $t(`curseforge.mc-mods.description`) }}
        </v-tooltip> -->
        <v-tooltip bottom>
          <template #activator="{ on }">
            <v-btn
              icon
              v-on="on"
              @click="goToCurseforgeMods()"
            >
              <v-icon :size="14">
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
        <v-tooltip bottom>
          <template #activator="{ on }">
            <v-btn
              icon
              v-on="on"
              @click="toggle()"
            >
              <v-icon>search</v-icon>
            </v-btn>
          </template>
          {{ $t("filter") }}
        </v-tooltip>
      </v-toolbar>
      <v-flex
        d-flex
        xs12
        style="padding-right: 5px; display: flex; flex-direction: column"
      >
        <hint
          v-if="items.length === 0"
          icon="save_alt"
          :text="$t('mod.dropHint')"
          :absolute="true"
          style="height: 100%"
        />
        <v-list
          v-else
          class="list"
          style="overflow-y: auto; background: transparent"
        >
          <transition-group
            name="transition-list"
            tag="div"
            :class="{ 'selection-mode': isSelectionMode }"
          >
            <mod-card
              v-for="(item, index) in items"
              :key="item.hash"
              v-observe-visibility="(visible) => onVisible(visible, index)"
              :source="item"
              :selection="isSelectionMode"
              :selected="isSelected(item)"
              :enabled="modifiedEnabled(item)"
              :dragged="isDragged(item)"
              @dragstart="onItemDragstart($event, item)"
              @select="select(item)"
              @click="onClick($event, index)"
              @enable="modifyMod(item, $event)"
            />
          </transition-group>
        </v-list>
      </v-flex>
    </v-layout>
    <float-button
      :deleting="isDraggingMod"
      :visible="isDraggingMod || isModified"
      :loading="saving"
      @drop="onDropDelete"
      @click="save"
    />
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
  </v-container>
</template>

<script lang=ts>
import { defineComponent, reactive, toRefs, computed, ref, Ref, provide, watch, onMounted, onUnmounted, set, nextTick } from '@vue/composition-api'
import { ForgeResource, LiteloaderResource } from '/@shared/entities/resource'
import { isCompatible } from '/@shared/entities/version'
import {
  useInstanceMods,
  useResourceOperation,
  useInstanceVersionBase,
  ModItem,
  useOperation,
  useDrop,
  useInstanceBase,
  useRouter,
  useService,
} from '/@/hooks'
import { useLocalStorageCacheBool } from '/@/hooks/useCache'
import { filter } from 'fuzzy'
import { isNonnull } from '/@shared/util/assert'
import { useSearchToggles, useSearch } from '../hooks'
import ModCard from './ModSettingPageCard.vue'
import DeleteView from './ModSettingPageDeleteView.vue'
import FloatButton from './ModSettingPageFloatButton.vue'
import { BaseServiceKey } from '/@shared/services/BaseService'

type ModResource = ForgeResource | LiteloaderResource

function setupDragMod(items: Ref<ModItem[]>, selectedMods: Ref<ModItem[]>, isSelectionMode: Ref<boolean>) {
  const dragged = reactive({} as Record<string, boolean>)
  const isDraggingMod = computed(() => Object.values(dragged).some((v) => v))

  watch(items, (arr) => {
    for (const m of arr) {
      if (!(m.hash in dragged)) {
        dragged[m.hash] = false
      }
    }
  })

  function isDragged(mod: ModItem) {
    if (!(mod.hash in dragged)) {
      set(dragged, mod.hash, false)
    }
    return dragged[mod.hash]
  }
  function onItemDragstart(event: DragEvent, mod: ModItem) {
    if (isSelectionMode.value && selectedMods.value.some(m => m.id === mod.id)) {
      event.dataTransfer!.setData('mods', selectedMods.value.map(m => m.hash).join(','))
      selectedMods.value.forEach((m) => { dragged[m.hash] = true })
    } else {
      event.dataTransfer!.setData('mod', mod.hash)
      dragged[mod.hash] = true
    }
  }
  function onDrageEnd() {
    Object.keys(dragged).forEach((k) => { dragged[k] = false })
  }
  return {
    isDraggingMod,
    isDragged,
    onDrageEnd,
    onItemDragstart,
  }
}

function setupEnable(items: Ref<ModItem[]>, isSelectionMode: Ref<boolean>, selectedMods: Ref<ModItem[]>, isSelected: (mod: ModItem) => boolean, commit: (mods: ModItem[]) => Promise<void>) {
  const modifiedItems = ref([] as ModItem[])
  const isModified = computed(() => modifiedItems.value.length > 0)
  const saving = ref(false)
  function modifyMod(mod: ModItem, value: boolean) {
    value = !!value
    const update = (oldValue: ModItem, newValue: boolean) => {
      if (newValue !== oldValue.enabled && modifiedItems.value.every(i => i.hash !== oldValue.hash)) {
        modifiedItems.value.push({ ...oldValue, enabled: newValue })
      } else if (newValue === oldValue.enabled && modifiedItems.value.some(i => i.hash === oldValue.hash)) {
        modifiedItems.value = modifiedItems.value.filter((v) => v.hash !== oldValue.hash)
      }
    }
    if (isSelectionMode.value && isSelected(mod)) {
      for (const mod of selectedMods.value) {
        update(mod, value)
      }
    } else {
      update(mod, value)
    }
  }
  function modifiedEnabled(mod: ModItem) {
    const modified = modifiedItems.value.some((i) => i.hash === mod.hash)
    return (!modified && mod.enabled) || (modified && !mod.enabled)
  }
  watch(items, (newValues) => {
    if (saving.value) {
      modifiedItems.value = []
    } else {
      const mods = [] as ModItem[]
      const enableds = new Set<string>()
      for (const mod of newValues) {
        if (mod.enabled) {
          enableds.add(mod.hash)
        }
      }
      for (const mod of modifiedItems.value) {
        if (mod.enabled && !enableds.has(mod.hash)) {
          mods.push(mod)
        } else if (!mod.enabled && enableds.has(mod.hash)) {
          mods.push(mod)
        }
      }
      modifiedItems.value = mods
    }
    saving.value = false
  })
  function save() {
    if (saving.value) return
    saving.value = true
    commit(modifiedItems.value).catch((e) => {
      console.error('Cannot save the mods setting:')
      console.error(e)
      saving.value = false
    })
  }
  return { modifiedEnabled, modifyMod, isModified, saving, save }
}

function setupDeletion(mods: Ref<ModItem[]>) {
  const { removeResource } = useResourceOperation()
  const { begin: beginDelete, cancel: cancelDelete, operate: confirmDelete, data: deletingMods } = useOperation<ModItem[]>([], (mods) => {
    for (const mod of mods) {
      removeResource(mod.hash)
    }
  })
  function onDropDelete(e: DragEvent) {
    const hash = e.dataTransfer!.getData('mod')
    if (hash) {
      const target = mods.value.find(m => m.hash === hash)
      if (target) {
        beginDelete([target])
      }
    }
    const hashs = e.dataTransfer!.getData('mods')
    if (hashs) {
      const toDeletes = hashs.split(',').map((hash) => mods.value.find(m => m.hash === hash)).filter(isNonnull)
      if (toDeletes.length > 0) {
        beginDelete(toDeletes)
      }
    }
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
  const selectedItems = reactive({} as Record<string, boolean>)
  const selectedMods = computed(() => items.value.filter(i => selectedItems[i.hash]))
  watch(items, (arr) => {
    isSelectionMode.value = false
    for (const m of arr) {
      if (!(m.hash in selectedItems)) {
        selectedItems[m.hash] = false
      }
    }
  })

  function select(...mod: ModItem[]) {
    if (!isSelectionMode.value) {
      isSelectionMode.value = true
    }
    for (const m of mod) {
      selectedItems[m.hash] = !selectedItems[m.hash]
    }
  }
  function selectOrUnselect(mod: ModItem) {
    if (isSelectionMode.value) {
      selectedItems[mod.hash] = !selectedItems[mod.hash]
    }
  }
  function isSelected(mod: ModItem) {
    if (!(mod.hash in selectedItems)) {
      set(selectedItems, mod.hash, false)
    }
    return selectedItems[mod.hash]
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
      Object.keys(selectedItems).forEach((k) => { selectedItems[k] = false })
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
  onMounted(() => {
    document.addEventListener('keydown', onKeyDown)
    document.addEventListener('keyup', onKeyup)
  })
  onUnmounted(() => {
    document.removeEventListener('keydown', onKeyDown)
    document.removeEventListener('keyup', onKeyup)
  })
  return {
    onClick,
    select,
    isSelectionMode,
    isSelected,
    selectedMods,
  }
}

export default defineComponent({
  components: {
    ModCard,
    DeleteView,
    FloatButton,
  },
  setup() {
    const data = reactive({
      filterInCompatible: useLocalStorageCacheBool('ModSettingPage.filterInCompatible', false),
      filterModId: '',

      visibleCount: 10,
    })
    const { minecraft } = useInstanceVersionBase()
    const { importResource } = useResourceOperation()
    const { items: mods, commit } = useInstanceMods()
    const { toggle } = useSearchToggles()
    const { text: filteredText } = useSearch()
    const { path } = useInstanceBase()
    const { openDirectory } = useService(BaseServiceKey)

    function isCompatibleMod(mod: ModItem) {
      if (mod.enabled) {
        return true
      }
      if (data.filterInCompatible) {
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
    const items = computed(() => filter(filteredText.value, mods.value, { extract: v => `${v.name} ${v.version} ${v.dependencies.minecraft}` })
      .map((r) => r.original)
      .filter(isCompatibleMod)
      .sort((a, b) => (a.enabled ? -1 : 1))
      .reduce(group, [])
      .filter((m, i) => i < data.visibleCount))

    const selection = setupSelection(items)
    const { isSelectionMode, selectedMods, isSelected } = selection

    const { onDrop: onDropToImport } = useDrop((file) => {
      importResource({ type: 'mods', path: file.path })
    })

    function setFilteredModid(mod: ModItem) {
      data.filterModId = mod.id
    }
    function onVisible(visible: boolean, index: number) {
      if (!visible) return
      if (data.visibleCount < index + 20) {
        data.visibleCount += 20
      }
    }
    function onDragOver(event: DragEvent) {
      // console.log(event);
    }
    const { replace } = useRouter()
    function goToCurseforgeMods() {
      replace(`/curseforge/mc-mods?from=${path.value}`)
    }
    function showModsFolder() {
      openDirectory(`${path.value}/mods`)
    }
    return {
      ...toRefs(data),
      ...setupDragMod(items, selectedMods, isSelectionMode),
      ...setupEnable(items, isSelectionMode, selectedMods, isSelected, commit),
      ...setupDeletion(mods),

      showModsFolder,
      goToCurseforgeMods,
      onVisible,

      items,
      onDropToImport,
      onDragOver,
      setFilteredModid,
      toggle,
      ModCard,

      ...selection,
    }
  },
})
</script>

<style>
</style>
