<template>
  <MarketBase
    :plans="{}"
    :items="groupedItems"
    :selection-mode="true"
    :item-height="itemHeight"
    :loading="loading"
    :error="error || searchError"
    :class="{
      dragover,
    }"
    @load="loadMore"
  >
    <template #actions>
      <MarketListHeader
        v-model:dense="denseView"
        :label="`${items.length} ${t('save.name', items.length)}`"
      />
    </template>
    <template #placeholder>
      <MarketEmptyPlaceholder />
    </template>
    <template #filter>
      <MarketFilterPanel
        :curseforge-category="curseforgeCategory"
        curseforge-category-filter="worlds"
        :curseforge-category-label="t('save.name', 2)"
        :curseforge-secondary-category="curseforgeDatapackCategory"
        curseforge-secondary-category-filter="data-packs"
        :curseforge-secondary-category-label="t('save.datapack.name', 2)"
        :modrinth-categories="modrinthCategories"
        modrinth-category-filter="datapack"
        :enable-curseforge="isCurseforgeActive"
        :enable-modrinth="isModrinthActive"
        v-model:sort="marketSort"
        :mode="source"
        :game-version="gameVersion"
        @update:curseforge-category="curseforgeCategory = $event"
        @update:curseforge-secondary-category="curseforgeDatapackCategory = $event"
        @update:modrinth-categories="modrinthCategories = $event"
        @update:enable-curseforge="isCurseforgeActive = $event"
        @update:enable-modrinth="isModrinthActive = $event"
        @update:mode="source = $event"
        @update:game-version="gameVersion = $event"
      >
        <template #local>
          <LinkSharedFolderSetting domain="saves" @changed="revalidate" />
        </template>
      </MarketFilterPanel>
    </template>
    <template #item="{ item, hasUpdate, checked, selectionMode, selected, on, index }">
      <v-list-subheader
        v-if="typeof item === 'string'"
        class="px-3 flex"
      >
        {{
          item === 'enabled'
            ? t('save.selected')
            : item === 'disabled'
              ? t('save.unselected')
              : t('modInstall.search')
        }}
      </v-list-subheader>
      <MarketItem
        v-else-if="isDatapackChild(item as ProjectEntry)"
        :item="item as ProjectEntry"
        :height="itemHeight"
        :checked="checked"
        :selection-mode="false"
        :selected="selected"
        :dense="denseView"
        indent
        indent-color="rgb(251 146 60)"
        :get-context-menu-items="() => getDatapackChildMenu(item as ProjectEntry)"
        @click="(e) => { currentSelected = (item as ProjectEntry); on.click(e) }"
      >
        <template #title-chip>
          <v-chip size="x-small" label variant="tonal" color="orange">
            <v-icon start size="x-small">layers</v-icon>
            {{ t('save.datapack.name', 1) }}
          </v-chip>
        </template>
      </MarketItem>
      <SaveItem
        v-else
        :item="item as ProjectEntry<InstanceSaveFile>"
        :item-height="itemHeight"
        :has-update="hasUpdate"
        :checked="checked"
        :selection-mode="selectionMode"
        :selected="selected"
        :dense="denseView"
        :is-datapack="isDatapackEntry(item as ProjectEntry)"
        @click="(e) => { currentSelected = (item as ProjectEntry); on.click(e) }"
        @delete="onDelete"
        @import-datapack="onImportDatapack"
      />
    </template>
    <template #content="{ selectedItem, selectedCurseforgeId, selectedModrinthId, updating }">
      <Hint v-if="dragover" icon="save_alt" :text="t('save.dropHint')" class="h-full" />
      <div
        v-else-if="isDatapackChild(selectedItem)"
        class="flex h-full flex-col gap-3 overflow-auto p-4"
      >
        <div class="flex items-center gap-3">
          <v-avatar size="64" rounded>
            <v-img :src="dpFile(selectedItem).icon || BuiltinImages.unknownServer" />
          </v-avatar>
          <div class="flex flex-col overflow-hidden">
            <span class="text-h6 overflow-hidden overflow-ellipsis whitespace-nowrap">
              {{ dpFile(selectedItem).name }}
            </span>
            <span class="text-caption opacity-70">
              {{ t('save.datapack.packFormat', { format: dpFile(selectedItem).packFormat }) }}
            </span>
          </div>
        </div>
        <div class="text-body-2 opacity-90 whitespace-pre-wrap">
          {{ dpFile(selectedItem).description }}
        </div>
        <div class="flex-grow" />
        <div class="flex gap-2">
          <v-btn variant="tonal" prepend-icon="folder" @click="showItemInDirectory(dpFile(selectedItem).path)">
            {{ t('logsCrashes.showFile') }}
          </v-btn>
          <v-btn color="error" variant="tonal" prepend-icon="delete" @click="onDeleteDatapack(dpFile(selectedItem))">
            {{ t('shared.delete') }}
          </v-btn>
        </div>
      </div>
      <MarketProjectDetailModrinth
        v-else-if="isDatapackEntry(selectedItem) && (selectedItem?.modrinth || selectedModrinthId)"
        :modrinth="selectedItem?.modrinth"
        :project-id="selectedModrinthId"
        :installed="[]"
        :game-version="gameVersion"
        :categories="modrinthCategories"
        :all-files="[]"
        :curseforge="selectedItem?.curseforge?.id || selectedCurseforgeId"
        :disable-install="saves.length === 0"
        @category="toggleModrinthCategory"
      >
        <template v-if="saves.length > 0" #install-target>
          <SaveTargetSelect
            v-model="targetSavePath"
            :items="saveSelectItems"
          />
        </template>
      </MarketProjectDetailModrinth>
      <MarketProjectDetailCurseforge
        v-else-if="isDatapackEntry(selectedItem) && (selectedItem?.curseforge || selectedCurseforgeId)"
        :curseforge="selectedItem?.curseforge"
        :curseforge-id="Number(selectedItem?.curseforge?.id || selectedCurseforgeId)"
        :installed="[]"
        :game-version="gameVersion"
        :category="curseforgeDatapackCategory"
        :all-files="[]"
        :modrinth="selectedItem?.modrinth?.project_id || selectedModrinthId"
        :disable-install="saves.length === 0"
        @category="curseforgeDatapackCategory = $event"
      >
        <template v-if="saves.length > 0" #install-target>
          <SaveTargetSelect
            v-model="targetSavePath"
            :items="saveSelectItems"
          />
        </template>
      </MarketProjectDetailCurseforge>
      <MarketProjectDetailCurseforge
        v-else-if="selectedItem && (selectedItem.curseforge || selectedCurseforgeId)"
        :curseforge="selectedItem.curseforge"
        :curseforge-id="Number(selectedCurseforgeId)"
        :installed="selectedItem.installed"
        :game-version="gameVersion"
        :all-files="[]"
        :category="curseforgeCategory"
        :updating="updating"
        @category="curseforgeCategory = $event"
      />
      <SaveDetail v-else-if="isSaveProject(selectedItem)" :save="selectedItem" @delete="onDelete" />
    </template>
    <SimpleDialog
      v-model="model"
      :title="t('save.deleteTitle')"
      :width="500"
      persistent
      @confirm="doDelete()"
    >
      {{ t('save.deleteHint') }}
      <div style="color: grey">
        {{ deleting?.path }}
      </div>
    </SimpleDialog>
  </MarketBase>
</template>

<script lang="ts" setup>
import Hint from '@/components/Hint.vue'
import MarketBase from '@/components/MarketBase.vue'
import MarketFilterPanel from '@/components/MarketFilterPanel.vue'
import MarketItem from '@/components/MarketItem.vue'
import MarketListHeader from '@/components/MarketListHeader.vue'
import MarketEmptyPlaceholder from '@/components/MarketEmptyPlaceholder.vue'
import LinkSharedFolderSetting from '@/components/LinkSharedFolderSetting.vue'
import MarketProjectDetailCurseforge from '@/components/MarketProjectDetailCurseforge.vue'
import MarketProjectDetailModrinth from '@/components/MarketProjectDetailModrinth.vue'
import { useService } from '@/composables'
import { useLocalStorage } from '@vueuse/core'
import { ContextMenuItem } from '@/composables/contextMenu'
import { CurseforgeBuiltinClassId } from '@/composables/curseforge'
import { kCurseforgeInstaller } from '@/composables/curseforgeInstaller'
import { kModrinthInstaller } from '@/composables/modrinthInstaller'
import { useGlobalDrop } from '@/composables/dropHandler'
import { InstanceSaveFile, kInstanceSave } from '@/composables/instanceSave'
import { InstanceDatapackFile, useInstanceSavesDatapacks, useSaveDatapackInstallers } from '@/composables/instanceSaveDatapack'
import { useNotifier } from '@/composables/notifier'
import { usePresence } from '@/composables/presence'
import { kSaveSearch } from '@/composables/savesSearch'
import { useToggleCategories } from '@/composables/toggleCategories'
import { BuiltinImages } from '@/constant'
import { vSharedTooltip } from '@/directives/sharedTooltip'
import { injection } from '@/util/inject'
import { ProjectEntry } from '@/util/search'
import { BaseServiceKey, InstanceSavesServiceKey, MarketType } from '@xmcl/runtime-api'
import SimpleDialog from '../components/SimpleDialog.vue'
import { useSimpleDialog } from '../composables/dialog'
import { kInstance } from '../composables/instance'
import SaveDetail from './SaveDetail.vue'
import SaveItem from './SaveItem.vue'
import SaveTargetSelect from './SaveTargetSelect.vue'
import { kSearchModel } from '@/composables/search'
import { sort } from '@/composables/sortBy'

const { path } = injection(kInstance)
const { error, deleteSave, saves, revalidate } = injection(kInstanceSave)

const { curseforgeCategory, gameVersion, currentView, keyword, source, isCurseforgeActive, isModrinthActive, modrinthCategories, sort: marketSort } = injection(kSearchModel)
const { effect, items, sortBy, loadMore, loading, error: searchError, curseforgeDatapackCategory } = injection(kSaveSearch)

effect()

const isSaveProject = (v: ProjectEntry | undefined): v is ProjectEntry<InstanceSaveFile> =>
  !!v?.installed && v.installed.length > 0

const denseView = useLocalStorage('savesDenseView', false, { writeDefaults: false })
const itemHeight = computed(() => (denseView.value ? 40 : 88))

// Installed datapacks across all saves, grouped by save path. Rendered as
// indented child rows under their save in the local (installed) view.
const { datapacksBySave, refresh: refreshDatapacks } = useInstanceSavesDatapacks(path)
watch(currentView, (v) => { if (v === 'local') refreshDatapacks() })

const isDatapackChild = (item: ProjectEntry | undefined) =>
  !!item && item.contentType === 'datapack' && (item.installed?.length ?? 0) > 0
const dpFile = (item: ProjectEntry | undefined) => item?.installed?.[0] as unknown as InstanceDatapackFile

const getSaveDatapackChildren = (save: ProjectEntry): ProjectEntry[] => {
  const savePath = (save.installed?.[0] as InstanceSaveFile | undefined)?.path
  const dps = savePath ? datapacksBySave.value[savePath] : undefined
  if (!dps || dps.length === 0) return []
  return dps.map((d) => markRaw({
    id: d.path,
    icon: d.icon,
    title: d.name,
    description: d.description,
    author: '',
    installed: [d],
    files: [d],
    contentType: 'datapack',
  } as ProjectEntry))
}

const groupedItems = computed(() => {
  const result: (ProjectEntry | string)[] = []
  const isLocal = currentView.value === 'local'

  const { enabled, disabled, others } = items.value.reduce(
    (arrays, item) => {
      if (item.installed && item.installed.length > 0) {
        if (item.disabled) {
          arrays.disabled.push(item)
        } else {
          arrays.enabled.push(item)
        }
      } else {
        arrays.others.push(item)
      }
      return arrays
    },
    {
      enabled: [] as ProjectEntry[],
      disabled: [] as ProjectEntry[],
      others: [] as ProjectEntry[],
    },
  )

  const pushWithChildren = (arr: ProjectEntry[]) => {
    for (const item of arr) {
      result.push(item)
      if (isLocal) {
        for (const child of getSaveDatapackChildren(item)) result.push(child)
      }
    }
  }

  if (enabled.length > 0) {
    result.push('enabled' as string)
    pushWithChildren(enabled)
  }
  if (disabled.length > 0) {
    result.push('disabled' as string)
    sort(sortBy.value, disabled)
    pushWithChildren(disabled)
  }
  if (others.length > 0) {
    result.push('search' as string)
    result.push(...others)
  }

  return result
})

const { importSave, installFromMarket, importDatapack, deleteDatapack } = useService(InstanceSavesServiceKey)
const { showItemInDirectory } = useService(BaseServiceKey)
const { notify } = useNotifier()

// The save market lists two content types side by side. Track the entry the
// user last opened so the shared installers know whether to install a world
// (into `saves/`) or a data pack (into the selected save's `datapacks/`).
// Note: Modrinth returns `project_type: "mod"` for data packs and only marks
// them via the `datapack` category, so we detect that instead of project_type.
const currentSelected = ref<ProjectEntry | undefined>(undefined)
const isDatapackEntry = (e: ProjectEntry | undefined) => {
  if (!e) return false
  // Primary: reliable tag set by the save search composable.
  if (e.contentType === 'datapack') return true
  // Fallbacks for entries opened via deep link / not produced by that search.
  if (e.curseforge?.classId === CurseforgeBuiltinClassId.datapack) return true
  const hit = e.modrinth as any
  if (hit) {
    const categories: string[] = hit.categories || hit.display_categories || []
    if (categories.includes('datapack')) return true
    if (hit.project_type === 'datapack') return true
  }
  return false
}
const isDatapackSelected = computed(() => isDatapackEntry(currentSelected.value))

// Target save selector for data pack installs.
const targetSavePath = ref('')
const saveSelectItems = computed(() => saves.value.map((s) => ({ title: s.name, value: s.path })))
watch(saves, () => {
  if (!targetSavePath.value || !saves.value.find((s) => s.path === targetSavePath.value)) {
    targetSavePath.value = saves.value[0]?.path || ''
  }
}, { immediate: true })

const toggleModrinthCategory = useToggleCategories(modrinthCategories)

// World (CurseForge only) installer -> installs into the instance `saves/` folder.
const worldInstaller = {
  install: async (file: any) => {
    await installFromMarket({ market: MarketType.CurseForge, instancePath: path.value, file })
  },
  installWithDependencies: async (id: number, _loaders: string[], icon: string | undefined) => {
    await installFromMarket({ market: MarketType.CurseForge, instancePath: path.value, file: { fileId: id, icon } })
  },
}

// Data pack installers -> install into the currently selected target save.
const { curseforgeInstaller: datapackCurseforge, modrinthInstaller: datapackModrinth } =
  useSaveDatapackInstallers(targetSavePath, () => refreshDatapacks())

const ensureTargetSave = () => {
  if (!targetSavePath.value) {
    notify({ level: 'warning', title: t('save.datapack.noSaveHint') })
    return false
  }
  return true
}

// The market detail components inject a single installer. Dispatch to the world
// or data pack installer depending on the selected entry's content type.
provide(kCurseforgeInstaller, {
  install: (file: any) => isDatapackSelected.value
    ? (ensureTargetSave() ? datapackCurseforge.install(file) : Promise.resolve())
    : worldInstaller.install(file),
  installWithDependencies: (id: any, loaders: any, icon: any, installed: any, deps: any) => isDatapackSelected.value
    ? (ensureTargetSave() ? datapackCurseforge.installWithDependencies(id, loaders, icon, installed, deps) : Promise.resolve())
    : worldInstaller.installWithDependencies(id, loaders, icon),
} as any)
provide(kModrinthInstaller, {
  install: (version: any) => ensureTargetSave() ? datapackModrinth.install(version) : Promise.resolve(),
  installWithDependencies: (versionId: any, loaders: any, icon: any, installed: any, deps: any) =>
    ensureTargetSave() ? datapackModrinth.installWithDependencies(versionId, loaders, icon, installed, deps) : Promise.resolve(false),
} as any)

const {
  target: deleting,
  confirm: doDelete,
  model,
  show,
} = useSimpleDialog<InstanceSaveFile>((save) => (save ? deleteSave(save) : undefined))
const onDelete = (save: InstanceSaveFile) => {
  show(save)
}

const onDeleteDatapack = (file: InstanceDatapackFile) => {
  deleteDatapack({ savePath: file.savePath, fileName: file.fileName })
  refreshDatapacks()
}
const getDatapackChildMenu = (item: ProjectEntry): ContextMenuItem[] => {
  const file = item.installed?.[0] as InstanceDatapackFile | undefined
  if (!file) return []
  return [
    { text: t('delete.name', { name: file.fileName }), icon: 'delete', color: 'red', onClick: () => onDeleteDatapack(file) },
    { text: t('mod.showFile', { file: file.path }), icon: 'folder', onClick: () => showItemInDirectory(file.path) },
  ]
}

const onImportDatapack = async ({ save, paths }: { save: InstanceSaveFile; paths: string[] }) => {
  for (const p of paths) {
    await importDatapack({ savePath: save.path, path: p })
  }
  refreshDatapacks()
  notify({ level: 'success', title: t('save.datapack.imported', { save: save.name }) })
}

const { t } = useI18n()
const { name } = injection(kInstance)
usePresence(computed(() => t('presence.save', { instance: name.value })))

// Drop
const { dragover } = useGlobalDrop({
  onDrop: async (t) => {
    for (const f of t.files) {
      importSave({ path: f.path, instancePath: path.value })
    }
  },
})
</script>
