<template>
  <MarketBase
    :plans="plans"
    :items="groupedItems"
    :selection-mode="isLocalView && selectionMode"
    :auto-selection-mode="isLocalView"
    :item-height="itemHeight"
    :loading="loading"
    :error="error"
    :class="{
      dragover,
    }"
    @load="onLoad"
    @update:selection-mode="onUpdateSelectionMode"
  >
    <template #actions>
      <MarketListHeader
        v-model:dense="denseView"
        :label="t('mod.mods', { count: items.length })"
        :total="!isLocalView ? totalAvailable : undefined"
      >
        <template v-if="isLocalView" #badges>
          <div class="flex items-center gap-1.5 ml-2">
            <v-chip
              size="x-small"
              color="primary"
              variant="tonal"
              class="font-medium"
            >
              {{ t('mod.enabled', { count: enabledCount }) }}
            </v-chip>
            <v-chip
              v-if="disabledCount > 0"
              size="x-small"
              color="surface-variant"
              variant="tonal"
              class="font-medium cursor-pointer"
              @click="onUpdateLocalFilter(localFilter === 'disabledOnly' ? undefined : 'disabledOnly')"
            >
              {{ disabledCount }} {{ t('shared.disable') }}
            </v-chip>
            <v-chip
              v-if="updateCount > 0"
              size="x-small"
              color="warning"
              variant="tonal"
              class="font-medium cursor-pointer"
              @click="onUpdateLocalFilter(localFilter === 'hasUpdateOnly' ? undefined : 'hasUpdateOnly')"
            >
              {{ updateCount }} {{ t('shared.checkUpgrade') }}
            </v-chip>
          </div>
        </template>
        <v-btn
          v-if="isLocalView"
          :class="{ 'v-btn--active': selectionMode }"
          icon
          variant="text"
          density="comfortable"
          data-testid="market-multi-select-toggle"
          @click="onUpdateSelectionMode(!selectionMode)"
        >
          <v-icon> checklist </v-icon>
        </v-btn>
        <v-btn
          v-if="isLocalView && groups.length > 0"
          v-shared-tooltip="() => isAllCollapsed ? t('mod.expandAll') : t('mod.collapseAll')"
          :aria-label="isAllCollapsed ? t('mod.expandAll') : t('mod.collapseAll')"
          icon
          variant="text"
          density="comfortable"
          data-testid="market-toggle-collapse-all"
          @click="toggleCollapseAll"
        >
          <v-icon>{{ isAllCollapsed ? 'unfold_more' : 'unfold_less' }}</v-icon>
        </v-btn>
        <v-menu v-if="isLocalView">
          <template #activator="{ props: menuProps }">
            <v-btn
              v-bind="menuProps"
              v-shared-tooltip="() => t('mod.autoCategorize')"
              icon
              variant="text"
              density="comfortable"
              data-testid="market-auto-categorize"
            >
              <v-icon> auto_awesome </v-icon>
            </v-btn>
          </template>
          <v-list density="compact" rounded="xl" elevation="8" class="p-1">
            <v-list-item
              v-if="groups.length > 0"
              prepend-icon="unfold_more"
              :title="t('mod.expandAll')"
              @click="expandAll"
            />
            <v-list-item
              v-if="groups.length > 0"
              prepend-icon="unfold_less"
              :title="t('mod.collapseAll')"
              @click="collapseAll"
            />
            <v-divider v-if="groups.length > 0" class="my-1" />
            <v-list-item
              prepend-icon="auto_awesome"
              :title="t('mod.autoCategorize')"
              :subtitle="t('mod.autoCategorizeHint')"
              @click="onAutoCategorize"
            />
            <v-list-item
              v-if="groups.length > 0"
              prepend-icon="folder_off"
              :title="t('mod.ungroupAll')"
              @click="ungroupAll"
            />
          </v-list>
        </v-menu>
        <v-btn
          v-if="!isLocalView"
          v-shared-tooltip="() => groupInstalled === 'off' ? t('mod.installedFilterOff') : groupInstalled === 'group' ? t('mod.groupInstalled') : t('mod.hideInstalled')"
          :class="{ 'v-btn--active': groupInstalled !== 'off' }"
          icon
          variant="text"
          density="comfortable"
          @click="groupInstalled = groupInstalled === 'off' ? 'group' : groupInstalled === 'group' ? 'hide' : 'off'"
        >
          <v-icon> {{ groupInstalled === 'hide' ? 'layers_clear' : groupInstalled === 'group' ? 'layers' : 'filter_none' }} </v-icon>
        </v-btn>
        <AppCollectionInstallAll
          v-if="showInstallAll"
          :items="collectionItems"
          content-type="mods"
          :runtime="runtime"
        />
      </MarketListHeader>
      <v-alert v-if="upgradeError" dense type="error">
        {{ updateErrorMessage }}
      </v-alert>
      <v-card
        v-if="Object.keys(conflicted).length > 0"
        class="mx-3 my-2 border border-red-500/30 bg-red-950/40 rounded-xl cursor-pointer hover:bg-red-950/60 transition-all"
        elevation="0"
        @click="showDuplicatedDialog"
      >
        <div class="flex items-center px-4 py-3 gap-3">
          <div class="w-8 h-8 rounded-lg bg-red-500/20 flex items-center justify-center flex-shrink-0">
            <v-icon color="red-lighten-2" size="20">warning</v-icon>
          </div>
          <div class="flex-1 min-w-0">
            <div class="text-sm font-semibold text-red-100">
              {{ localizedTexts.mod.duplicatedDetected }}
            </div>
          </div>
          <v-btn
            size="small"
            variant="tonal"
            color="error"
            class="flex-shrink-0 font-semibold"
            @click.stop="showDuplicatedDialog"
          >
            {{ t('shared.manage') || 'Manage' }}
          </v-btn>
        </div>
      </v-card>
    </template>
    <template #placeholder>
      <MarketEmptyPlaceholder />
    </template>
    <template #filter>
      <MarketFilterPanel
        :curseforge-category="curseforgeCategory"
        :modrinth-categories="modrinthCategories"
        :local-sort="sortBy"
        curseforge-category-filter="mc-mods"
        modrinth-category-filter="mod"
        :collection="selectedCollection"
        :enable-curseforge="isCurseforgeActive"
        :enable-modrinth="isModrinthActive"
        v-model:sort="sort"
        :mode="source"
        :game-version="gameVersion"
        :modloader="modLoader"
        :mod-loaders="[ModLoaderFilter.forge, ModLoaderFilter.neoforge, ModLoaderFilter.fabric, ModLoaderFilter.quilt]"
        :modrinth-environment="modrinthEnvironment"
        @update:curseforge-category="curseforgeCategory = $event"
        @update:modrinth-categories="modrinthCategories = $event"
        @update:local-sort="sortBy = $event"
        @update:collection="selectedCollection = $event"
        @update:enable-curseforge="isCurseforgeActive = $event"
        @update:enable-modrinth="isModrinthActive = $event"
        @update:mode="source = $event"
        @update:game-version="gameVersion = $event"
        @update:modloader="modLoader = $event"
        @update:modrinth-environment="modrinthEnvironment = $event"
      >
        <template #local>
          <!-- Quick Filter & Loaders Card -->
          <v-card
            class="mod-filter-card rounded-xl border border-white/10 bg-white/[0.02] p-4 mb-4"
            elevation="0"
          >
            <!-- Mod Loaders Section -->
            <div class="text-xs font-semibold uppercase tracking-wider text-medium-emphasis flex items-center gap-1.5 mb-2.5">
              <v-icon size="16" color="primary">extension</v-icon>
              <span>{{ t('modrinth.modLoaders.name') }}</span>
            </div>
            <div class="flex flex-wrap gap-1.5 mb-4">
              <v-chip
                size="small"
                variant="tonal"
                :color="!MODLOADER_FILTERS.includes(localFilter) ? 'primary' : undefined"
                class="font-medium cursor-pointer"
                @click="onUpdateLocalFilter(undefined)"
              >
                {{ t('modrinth.environments.all') }}
              </v-chip>
              <v-chip
                v-for="tag in modLoaderFilterItems"
                :key="tag.value"
                size="small"
                variant="tonal"
                :color="localFilter === tag.value ? 'primary' : undefined"
                class="font-medium cursor-pointer"
                @click="onUpdateLocalFilter(localFilter === tag.value ? undefined : tag.value)"
              >
                <template #prepend>
                  <v-icon size="14" class="mr-1">{{ tag.icon }}</v-icon>
                </template>
                {{ tag.text }}
              </v-chip>
            </div>

            <!-- Mod Status Filter Section -->
            <div class="text-xs font-semibold uppercase tracking-wider text-medium-emphasis flex items-center gap-1.5 mb-2.5">
              <v-icon size="16" color="primary">filter_alt</v-icon>
              <span>{{ t('mod.filter') }}</span>
            </div>
            <div class="flex flex-wrap gap-1.5">
              <v-chip
                size="small"
                variant="tonal"
                :color="!localFilter ? 'primary' : undefined"
                class="font-medium cursor-pointer"
                @click="onUpdateLocalFilter(undefined)"
              >
                {{ t('modrinth.environments.all') }}
              </v-chip>
              <v-chip
                v-for="tag in filterItems"
                :key="tag.value"
                :disabled="tag.disabled"
                size="small"
                variant="tonal"
                :color="localFilter === tag.value ? 'primary' : undefined"
                class="font-medium cursor-pointer"
                v-shared-tooltip="tag.text"
                @click="onUpdateLocalFilter(localFilter === tag.value ? undefined : tag.value)"
              >
                <template #prepend>
                  <v-icon size="14" class="mr-1">{{ tag.icon }}</v-icon>
                </template>
                {{ tag.label || tag.text }}
              </v-chip>
            </div>
          </v-card>

          <ModOptionsPage
            v-model:denseView="denseView"
            :groups-count="groups.length"
            :is-all-collapsed="isAllCollapsed"
            @auto-categorize="onAutoCategorize"
            @ungroup-all="ungroupAll"
            @toggle-collapse-all="toggleCollapseAll"
          />
        </template>
      </MarketFilterPanel>
    </template>
    <template #item="{ item, hasUpdate, checked, selectionMode, selected, on }">
      <ModItem
        v-if="typeof item === 'object' && 'id' in item"
        :item="(item as ProjectEntry<ModFile>)"
        :key="`item-${item.id}`"
        :indent="isLocalView && !!isInGroup(((item as ProjectEntry<ModFile>).installed?.[0]?.fileName))"
        :indent-color="getGroupColor((item as ProjectEntry<ModFile>).installed?.[0]?.fileName)"
        :item-height="itemHeight"
        :has-update="hasUpdate"
        :checked="checked"
        :selection-mode="selectionMode"
        :selected="selected"
        :install="onInstallProject"
        :dense="denseView"
        :draggable="isLocalView"
        :get-context-menu-items="getContextMenuItems"
        @click="on.click"
        @click-dependency="onClickDependency"
        @drop-on-mod="handleModDropOnMod"
      />
      <ModGroupEntryItem
        v-else-if="typeof item === 'object'"
        :key="`folder-${item.name}-${item.projects.length}-${item.color}-${item.icon}-${item.pinned}`"
        :items="(item.projects as ProjectEntry<ModFile>[])"
        :height="itemHeight"
        :name="item.name"
        :color="item.color"
        :icon="item.icon"
        :pinned="item.pinned"
        :expanded="!groupCollapsedState[item.name]"
        :dense="denseView"
        @ungroup="ungroup(item.name)"
        @expand="onGroupCollapse(item as ProjectGroup<ModFile>, $event)"
        @setting="updateGroupSetting(item.name, $event)"
        @toggle-pin="toggleGroupPin(item.name)"
        @enable-all="enableAll(item)"
        @disable-all="disableAll(item)"
        @apply-group-rules="applySharedGroupRules()"
        @save-group-rules="syncGroupRules()"
        @drop-mod="handleModDropOnFolder"
      />
      <v-list-subheader
        v-else-if="item === 'search'"
        key="search"
        class="px-3"
      >
        <v-divider class="mr-4" />
        {{ localizedTexts.mod.search }}
        <v-divider class="ml-4" />
      </v-list-subheader>
      <v-list-subheader
        v-else-if="item === 'unsupported'"
        class="px-3"
        key="unsupported"
      >
        <v-divider class="mr-4" />
        {{ localizedTexts.mod.unsupported }}
        <v-divider class="ml-4" />
      </v-list-subheader>
    </template>
    <template #content="{ selectedItem, selectedModrinthId, selectedCurseforgeId, updating }">
      <Hint
        v-if="dragover"
        key="dragover"
        icon="save_alt"
        :text="t('mod.dropHint')"
        :size="100"
        class="h-full"
      />
      <MarketProjectDetailModrinth
        v-else-if="shouldShowModrinth(selectedItem, selectedModrinthId, selectedCurseforgeId)"
        :key="selectedModrinthId"
        :modrinth="selectedItem?.modrinth"
        :project-id="selectedModrinthId"
        :upgrade-version="getModrinthUpgradeVersion(selectedModrinthId)"
        :installed="selectedItem?.installed || getInstalledModrinth(selectedModrinthId)"
        :loader="modLoader"
        :categories="modrinthCategories"
        :all-files="mods"
        :dependents="getProjectDependents(selectedItem?.installed || getInstalledModrinth(selectedModrinthId))"
        :updating="updating"
        :game-version="gameVersion"
        :curseforge="selectedItem?.curseforge?.id || selectedCurseforgeId"
        collection-content-type="mods"
        @open-dependent="openModDependent"
        @uninstall="onUninstall"
        @enable="onEnable"
        @disable="onDisable"
        @category="toggleCategory"
      />
      <MarketProjectDetailCurseforge
        v-else-if="shouldShowCurseforge(selectedItem, selectedModrinthId, selectedCurseforgeId)"
        :key="selectedCurseforgeId"
        :curseforge="selectedItem?.curseforge"
        :curseforge-id="Number(selectedCurseforgeId)"
        :installed="selectedItem?.installed || getInstalledCurseforge(selectedCurseforgeId)"
        :game-version="gameVersion"
        :loader="modLoader"
        :category="curseforgeCategory"
        :all-files="mods"
        :dependents="getProjectDependents(selectedItem?.installed || getInstalledCurseforge(selectedCurseforgeId))"
        :updating="updating"
        :modrinth="selectedModrinthId"
        collection-content-type="mods"
        @open-dependent="openModDependent"
        @uninstall="onUninstall"
        @enable="onEnable"
        @disable="onDisable"
        @category="curseforgeCategory = $event"
      />
      <ModDetailOptifine
        v-else-if="isOptifineProject(selectedItem)"
        :key="`optifine-${selectedItem.id}`"
        :mod="selectedItem"
        :runtime="runtime"
      />
      <ModDetailResource
        v-else-if="isModProject(selectedItem)"
        :key="`resource-${selectedItem.id}`"
        :mod="selectedItem"
        :files="selectedItem.files"
        :runtime="runtime"
        :installed="selectedItem.installed"
        :dependents="getProjectDependents(selectedItem.installed)"
        @open-dependent="openModDependent"
      />
    </template>
    <v-dialog v-model="wizardModel" width="600">
      <v-card :title="localizedTexts.mod.noModLoaderHint">
        <v-card-text>
          <!-- {{ t('mod.modloaderSelectHint') }} -->
          {{ localizedTexts.mod.modloaderSelectHint }}
          <v-list nav>
            <v-list-item v-for="i of wizardModItems" :key="i.title" @click="i.onSelect">
              <template #prepend
                ><v-avatar>
                  <img :src="i.icon" /> </v-avatar
              ></template>
              <v-list-item-title>
                {{ i.title }}
              </v-list-item-title>
              <v-list-item-subtitle>
                <a :href="i.url" @click.stop>{{ i.url }}</a>
              </v-list-item-subtitle>
            </v-list-item>
          </v-list>
          <v-alert v-if="wizardError" type="error">
            <span v-if="'loader' in wizardError">
              <!-- {{ t('mod.modloaderSelectNotSupported', { loader: wizardError.loader, minecraft: wizardError.minecraft }) }} -->
              {{ localizedTexts.mod.modloaderSelectNotSupported }}
            </span>
            <div v-else>
              {{ wizardError.message }}
            </div>
          </v-alert>
        </v-card-text>
      </v-card>
    </v-dialog>
    <ModDuplicatedDialog />
    <ModIncompatibileDialog />
  </MarketBase>
</template>

<script lang="ts" setup>
import Hint from '@/components/Hint.vue'
import type { ProjectDependent } from '@/components/MarketProjectDetail.vue'
import MarketBase from '@/components/MarketBase.vue'
import MarketFilterPanel from '@/components/MarketFilterPanel.vue'
import MarketListHeader from '@/components/MarketListHeader.vue'
import MarketEmptyPlaceholder from '@/components/MarketEmptyPlaceholder.vue'
import MarketProjectDetailCurseforge from '@/components/MarketProjectDetailCurseforge.vue'
import MarketProjectDetailModrinth from '@/components/MarketProjectDetailModrinth.vue'
import AppCollectionInstallAll from '@/components/AppCollectionInstallAll.vue'
import { useService } from '@/composables'
import { ContextMenuItem } from '@/composables/contextMenu'
import { kCurseforgeInstaller, useCurseforgeInstaller } from '@/composables/curseforgeInstaller'
import { useDialog } from '@/composables/dialog'
import { getDropFilePaths, useGlobalDrop } from '@/composables/dropHandler'
import { kInstance } from '@/composables/instance'
import { kInstanceDefaultSource } from '@/composables/instanceDefaultSource'
import { kInstanceModsContext } from '@/composables/instanceMods'
import { ProjectGroup, useModGroups } from '@/composables/modGroup'
import { useModsSearch } from '@/composables/modSearch'
import { kModUpgrade } from '@/composables/modUpgrade'
import { ArtifactLoader, resolveArtifactModrinthDependencies } from '@/composables/modArtifactDependencies'
import { useModWizard } from '@/composables/modWizard'
import { useNotifier } from '@/composables/notifier'
import { kModrinthInstaller, useModrinthInstaller } from '@/composables/modrinthInstaller'
import { usePresence } from '@/composables/presence'
import { useProjectInstall } from '@/composables/projectInstall'
import { kCompact } from '@/composables/scrollTop'
import { useToggleCategories } from '@/composables/toggleCategories'
import { useTutorial } from '@/composables/tutorial'
import { vRovingTabindex } from '@/directives/rovingTabindex'
import { vSharedTooltip } from '@/directives/sharedTooltip'
import { injection } from '@/util/inject'
import { clientModrinthV2 } from '@/util/clients'
import { ModFile, getModDependents, isModFile } from '@/util/mod'
import { flattenVisibleModGroups, isProjectInModGroup } from '@/util/modGroupFilter'
import { ProjectEntry, ProjectFile } from '@/util/search'
import { InstanceModsServiceKey, normalizeModFileName } from '@xmcl/runtime-api'
import { useDebounceFn } from '@vueuse/core'
import ModDetailOptifine from './ModDetailOptifine.vue'
import ModDetailResource from './ModDetailResource.vue'
import ModDuplicatedDialog from './ModDuplicatedDialog.vue'
import ModGroupEntryItem from './ModGroupEntryItem.vue'
import ModIncompatibileDialog from './ModIncompatibileDialog.vue'
import ModItem from './ModItem.vue'
import { kModDependenciesCheck } from '@/composables/modDependenciesCheck'
import { kModLibCleaner } from '@/composables/modLibCleaner'
import { basename } from '@/util/basename'
import { kSearchModel, ModLoaderFilter } from '@/composables/search'
import { kSettingsState } from '@/composables/setting'
import { kModrinthAuthenticatedAPI } from '@/composables/modrinthAuthenticatedAPI'
import ModOptionsPage from './ModOptionsPage.vue'

const localizedTexts = computed(() =>
  markRaw({
    mod: {
      mods: t('mod.mods'),
      group: t('mod.group'),
      delete: {
        name: t('delete.name'),
      },
      enable: t('shared.enable'),
      disabe: t('shared.disable'),
      denseView: t('mod.denseView'),
      groupInstalled: t('mod.groupInstalled'),
      checkDependencies: t('modInstall.checkDependencies'),
      checkedDependencies: t('modInstall.checkedDependencies'),
      installDependencies: t('modInstall.installDependencies'),
      scanUnusedLibraries: t('modInstall.scanUnusedLibraries'),
      removeUnusedLibraries: t('modInstall.removeUnusedLibraries'),
      noModLoaderHint: t('mod.noModLoaderHint'),
      modloaderSelectHint: t('mod.modloaderSelectHint'),
      modloaderSelectNotSupported: t('mod.modloaderSelectNotSupported'),
      duplicatedDetected: t('mod.duplicatedDetected', {
        count: Object.keys(conflicted.value).length,
      }),
      incompatibleHint: t('mod.incompatibleHint'),
      search: t('modInstall.search'),
      unsupported: t('modrinth.environments.unsupported'),
      dropHint: t('mod.dropHint'),
    },
    modUpgradePolicy: {
      modrinth: t('modUpgradePolicy.modrinth'),
      curseforge: t('modUpgradePolicy.curseforge'),
      modrinthOnly: t('modUpgradePolicy.modrinthOnly'),
      curseforgeOnly: t('modUpgradePolicy.curseforgeOnly'),
    },
  }),
)

const { runtime, path } = injection(kInstance)

const searchModel = injection(kSearchModel)
const {
  keyword,
  modrinthCategories,
  curseforgeCategory,
  modLoader,
  gameVersion,
  currentView,
  source,
  isCurseforgeActive,
  isModrinthActive,
  sort,
  selectedCollection,
  modrinthEnvironment,
} = searchModel

const {
  mods,
  conflicted,
  revalidate,
  incompatible,
  compatibility,
  loaderIncompatibilities,
  enable,
  disable,
  isValidating,
} = injection(kInstanceModsContext)

const getProjectDependents = (installedFiles: ProjectEntry['installed'] | undefined): ProjectDependent[] =>
  getModDependents(installedFiles, mods.value, modLoader.value)
const { state: settingsState } = injection(kSettingsState)
const modrinthAPI = injection(kModrinthAuthenticatedAPI)

// Ensure mod search effect is applied
const {
  error,
  loading,
  items,
  collectionItems,
  effect,
  denseView,
  sortBy,
  groupInstalled,
  localFilter,
  loadMore,
  totalAvailable,
} = useModsSearch(path, runtime, mods, isValidating, settingsState, modrinthAPI, searchModel)

effect()

const { effect: onDependenciesEffect, installation } = injection(kModDependenciesCheck)
onDependenciesEffect()

const { unusedMods } = injection(kModLibCleaner)

const filterItems = computed(() => {
  const hasUpdate = Object.keys(plans.value).length > 0
  const hasDependenciesInstall = Object.keys(installation.value).length > 0
  const hasUnusedMods = Object.keys(unusedMods.value).length > 0
  const result = [{
    icon: 'flash_off',
    text: t('modFilter.disabledOnly'),
    label: t('shared.disable'),
    disabled: false,
    value: 'disabledOnly',
  }, {
    icon: 'info',
    text: t('modFilter.incompatibleOnly'),
    label: t('dependencies.incompatible'),
    value: 'incompatibleOnly',
  }]
  result.push({
    icon: 'recycling',
    disabled: !hasUnusedMods,
    text: t('modFilter.unusedOnly'),
    label: t('instanceFileOperation.remove'),
    value: 'unusedOnly',
  })
  result.push({
    icon: 'merge',
    disabled: !hasDependenciesInstall,
    text: t('modFilter.dependenciesInstallOnly'),
    label: t('dependencies.name'),
    value: 'dependenciesInstallOnly',
  })
  result.push({
    icon: 'update',
    disabled: !hasUpdate,
    text: t('modFilter.hasUpdateOnly'),
    label: t('shared.checkUpgrade'),
    value: 'hasUpdateOnly',
  })
  return result
})

const modLoaderFilterItems = computed(() => {
  return [{
    icon: 'xmcl:forge',
    text: 'Forge',
    value: 'forgeOnly',
  }, {
    icon: 'xmcl:neoForged',
    text: 'NeoForge',
    value: 'neoforgeOnly',
  }, {
    icon: 'xmcl:fabric',
    text: 'Fabric',
    value: 'fabricOnly',
  }, {
    icon: 'xmcl:quilt',
    text: 'Quilt',
    value: 'quiltOnly',
  }]
})

function getFilterButtonValue() {
  const idx = filterItems.value.findIndex(i => i.value === localFilter.value)
  return idx >= 0 ? idx : undefined
}

function getModLoaderFilterValue() {
  const idx = modLoaderFilterItems.value.findIndex(i => i.value === localFilter.value)
  return idx >= 0 ? idx : undefined
}

function onUpdateLocalFilter(filter: string | undefined) {
  localFilter.value = (filter ?? '') as any
}

const isLocalView = computed(() => {
  return currentView.value === 'local'
})

const {
  localGroupedItems,
  groupCollapsedState,
  collapseAllGroups,
  renameGroup,
  updateGroupSetting,
  toggleGroupPin,
  ungroup,
  ungroupAll,
  autoCategorizeMods,
  group,
  addToGroup,
  isInGroup,
  getGroupColor,
  getContextMenuItemsForGroup,
  groups,
  groupsRaw,
  groupModCounts,
  syncGroupRules,
  applySharedGroupRules,
  isAllCollapsed,
  toggleCollapseAll,
  expandAll,
  collapseAll,
} = useModGroups(isLocalView, path, items, sortBy)

const { notify } = useNotifier()

function onAutoCategorize() {
  autoCategorizeMods()
}

function enableAll(group: ProjectGroup) {
  const files = group.projects
    .filter((p) => p.installed?.[0])
    .map((p) => p.installed?.[0]?.path)
    .filter(Boolean)
  enable({ path: path.value, files })
}

function disableAll(group: ProjectGroup) {
  const files = group.projects
    .filter((p) => p.installed?.[0])
    .map((p) => p.installed?.[0]?.path)
    .filter(Boolean)
  disable({ path: path.value, files })
}

const loaderIncompatSet = computed(() => new Set(loaderIncompatibilities.value.map(issue => issue.file)))

function isIncompatible(p: ProjectEntry<ModFile>) {
  const installed = p.installed?.[0]
  const modId = installed?.modId
  if (!modId) {
    return false
  }
  if (loaderIncompatSet.value.has(installed.fileName)) return true
  const items = compatibility.value[modId]
  if (!items) {
    return false
  }
  for (const i of items) {
    if (i.compatible !== true) {
      return true
    }
  }

  return false
}

function handleModDropOnFolder({ fileName, groupName }: { fileName: string; groupName: string }) {
  if (!fileName || !groupName) return
  addToGroup([fileName], groupName)
}

function handleModDropOnMod({
  sourceFileName,
  targetFileName,
  targetTitle,
}: {
  sourceFileName: string
  targetFileName: string
  targetTitle: string
}) {
  if (!sourceFileName || !targetFileName || sourceFileName === targetFileName) return

  const normSource = normalizeModFileName(sourceFileName)
  const normTarget = normalizeModFileName(targetFileName)

  const currentGroups = groupsRaw.value ?? {}

  // Find if target is in a group
  const targetGroupName = Object.entries(currentGroups).find(([_, g]) =>
    g.files.some(f => normalizeModFileName(f) === normTarget)
  )?.[0]

  // Find if source is in a group
  const sourceGroupName = Object.entries(currentGroups).find(([_, g]) =>
    g.files.some(f => normalizeModFileName(f) === normSource)
  )?.[0]

  if (targetGroupName) {
    // If target is in a group, add source to target's group
    addToGroup([sourceFileName], targetGroupName)
  } else if (sourceGroupName) {
    // If source is in a group but target is not, add target to source's group
    addToGroup([targetFileName], sourceGroupName)
  } else {
    // Neither is in a group: create a new folder!
    const cleanTitle = (targetTitle || 'Mods').trim()
    const baseName = `Folder (${cleanTitle})`
    let folderName = baseName
    let counter = 2
    while (groups.value.includes(folderName)) {
      folderName = `${baseName} ${counter++}`
    }
    group([sourceFileName, targetFileName], folderName)
  }
}

// Mapping of modloader filter values to modloader names
const MODLOADER_FILTER_MAP: Record<string, string> = {
  forgeOnly: 'forge',
  neoforgeOnly: 'neoforge',
  fabricOnly: 'fabric',
  quiltOnly: 'quilt',
}
const MODLOADER_FILTERS = Object.keys(MODLOADER_FILTER_MAP)

// Helper function to check if a mod matches the modloader filter
function matchesModLoaderFilter(item: ProjectEntry<ModFile>, filterValue: string): boolean {
  const mod = item.installed?.[0]
  if (!mod) return true // If no installed mod, don't filter it out

  const modLoaders = mod.modLoaders || []
  const targetLoader = MODLOADER_FILTER_MAP[filterValue]
  return targetLoader ? modLoaders.includes(targetLoader) : true
}

const groupedItems = computed(() => {
  const result = items.value

  const installationSet = new Set(installation.value.map(([_, file]) => basename(file.path)))
  const unusedSet = new Set(unusedMods.value.map((file) => basename(file.path, '/')))

  const matchesLocalFilter = (item: ProjectEntry<ModFile>) => {
    if (localFilter.value === 'disabledOnly' && !item.disabled) return false
    if (localFilter.value === 'incompatibleOnly' && !isIncompatible(item)) return false
    if (localFilter.value === 'hasUpdateOnly' && !plans.value[item.id]) return false
    const installed = item.installed[0]
    if (
      installed &&
      localFilter.value === 'dependenciesInstallOnly' &&
      !installationSet.has(basename(installed.path))
    ) return false
    if (
      installed &&
      localFilter.value === 'unusedOnly' &&
      !unusedSet.has(basename(installed.path))
    ) return false
    if (
      MODLOADER_FILTERS.includes(localFilter.value) &&
      !matchesModLoaderFilter(item, localFilter.value)
    ) return false
    return true
  }

  if (isLocalView.value) {
    const sortableEntity = localGroupedItems.value
    return flattenVisibleModGroups(
      sortableEntity,
      matchesLocalFilter,
      groupCollapsedState.value,
    ).map(item => 'projects' in item ? markRaw(item) : item)
  }

  const transformed: Array<ProjectEntry<ModFile> | string> = []
  let rest = result

  if (groupInstalled.value === 'hide') {
    rest = rest.filter(i => i.installed.length === 0)
  } else if (groupInstalled.value === 'group') {
    const [installed, uninstalled] = rest.reduce(
      (acc, i) => {
        if (i.installed.length > 0) {
          acc[0].push(i)
        } else {
          acc[1].push(i)
        }
        return acc
      },
      [[], []] as [ProjectEntry<ModFile>[], ProjectEntry<ModFile>[]],
    )
    transformed.push(...installed)
    rest = uninstalled
  }

  const [supported, unsupported] = rest.reduce(
    (acc, i) => {
      if (!i.unsupported) {
        acc[0].push(i)
      } else {
        acc[1].push(i)
      }
      return acc
    },
    [[], []] as [ProjectEntry<ModFile>[], ProjectEntry<ModFile>[]],
  )

  return [
    ...transformed,
    ...(supported.length > 0 ? ['search', ...supported] : []),
    ...(unsupported.length > 0 ? ['unsupported' as string, ...unsupported] : []),
  ]
})

const isModProject = (
  v: ProjectEntry<ProjectFile> | undefined,
): v is ProjectEntry<ModFile> & { files: ModFile[] } => !!v?.files
const isOptifineProject = (v: ProjectEntry<ProjectFile> | undefined): v is ProjectEntry<ModFile> =>
  v?.id === 'OptiFine'

// Upgrade
const { plans, error: upgradeError } = injection(kModUpgrade)

const getModrinthUpgradeVersion = (projectId: string) => {
  const plan = plans.value[projectId]
  return plan && 'version' in plan ? plan.version : undefined
}

const updateErrorMessage = computed(() => {
  if (upgradeError) return (upgradeError.value as any).message
  return ''
})

const enabledCount = computed(() => mods.value.filter(m => m.enabled).length)
const disabledCount = computed(() => mods.value.filter(m => !m.enabled).length)
const updateCount = computed(() => Object.keys(plans.value).length)

const defaultSource = injection(kInstanceDefaultSource)
const shouldShowModrinth = (
  selectedItem: undefined | ProjectEntry,
  selectedModrinthId: string,
  selectedCurseforgeId: number | undefined,
) => {
  if (selectedItem?.modrinth) {
    return true
  }
  if (selectedItem?.curseforge) {
    return false
  }
  const hasModrinth = selectedItem?.modrinth || selectedModrinthId
  if (!hasModrinth) return false
  const hasCurseforge = selectedItem?.curseforge || selectedCurseforgeId
  if (defaultSource.value === 'curseforge' && hasCurseforge) {
    return false
  }
  return true
}
const shouldShowCurseforge = (
  selectedItem: undefined | ProjectEntry,
  selectedModrinthId: string,
  selectedCurseforgeId: number | undefined,
) => {
  if (selectedItem?.curseforge) {
    return true
  }
  const hasCurseforge = selectedItem?.curseforge || selectedCurseforgeId
  if (!hasCurseforge) return false
  const hasModrinth = selectedItem?.modrinth || selectedModrinthId
  if (defaultSource.value === 'modrinth' && hasModrinth) {
    return false
  }
  return true
}

// Install-all is available for any collection open in the Favorites view —
// launcher-owned local collections as well as Modrinth collections/follows.
const showInstallAll = computed(() => source.value === 'favorite')

const { show: showDuplicatedDialog } = useDialog('mod-duplicated')
const { show: showIncompatibleDialog } = useDialog('mod-incompatible')

const getInstalledModrinth = (projectId: string) => {
  return mods.value.filter((m) => m.modrinth?.projectId === projectId)
}
const getInstalledCurseforge = (modId: number | undefined) => {
  return mods.value.filter((m) => m.curseforge?.projectId === modId)
}

const route = useRoute()
const { replace } = useRouter()

function onCollapseAllGroups() {
  collapseAllGroups()
  // Match individual collapse: close details only when their group is hidden.
  if (localGroupedItems.value.some(item => 'projects' in item && isProjectInModGroup(item, route.query.id as string | undefined))) {
    const query = { ...route.query }
    delete query.id
    replace({ query })
  }
}

function onGroupCollapse(group: ProjectGroup<ModFile>, collapsed: boolean) {
  groupCollapsedState.value = { ...groupCollapsedState.value, [group.name]: collapsed }
  if (collapsed && isProjectInModGroup(group, route.query.id as string | undefined)) {
    const query = { ...route.query }
    delete query.id
    replace({ query })
  }
}

watch(
  computed(() => route.fullPath),
  () => {
    keyword.value = (route.query.keyword as string) ?? ''
  },
  { immediate: true },
)

// Remember the source the user explicitly picks in the detail view so the next
// mod that has both providers defaults to the same source.
watch(
  computed(() => route.query.id as string | undefined),
  (id) => {
    if (!id) return
    if (id.startsWith('curseforge:')) {
      defaultSource.value = 'curseforge'
    } else if (id.startsWith('modrinth:')) {
      defaultSource.value = 'modrinth'
    }
  },
)

const onLoad = loadMore

const onClickDependency = (modId: string) => {
  // Switch to remote (market) view and set the keyword to search for the dependency
  source.value = 'remote'
  keyword.value = modId
}

// install / uninstall / enable / disable
const { install, uninstall, resolveFromMarket } =
  useService(InstanceModsServiceKey)
const onUninstall = (f: ProjectFile[], _path?: string) => {
  uninstall({ path: _path ?? path.value, files: f.map((f) => f.path) }).then(() => {
    setTimeout(revalidate, 1500)
  })
}
const onEnable = async (f: ProjectFile, _path?: string) => {
  if (await wizardHandleOnEnable(f as ModFile, _path || path.value)) {
    return
  }
  enable({ path: _path ?? path.value, files: [f.path] }).then(() => {
    setTimeout(revalidate, 1500)
  })
}
const onDisable = (f: ProjectFile, _path?: string) => {
  disable({ path: _path ?? path.value, files: [f.path] }).then(() => {
    setTimeout(revalidate, 1500)
  })
}

// Categories
const toggleCategory = useToggleCategories(modrinthCategories)

// View
const itemHeight = computed(() => (denseView.value ? 40 : 90))
const selections = ref({} as Record<string, boolean>)

provide('selections', selections)

const selectionMode = ref(false)
function onUpdateSelectionMode(v: boolean) {
  selectionMode.value = v
  if (!v) selections.value = {}
}
watch(isLocalView, (local) => {
  if (!local) onUpdateSelectionMode(false)
})

const { show: showGroupSelectDialog } = useDialog('mod-group-select')

function showGroupDialog(fileNames: string[]) {
  console.log(groupsRaw.value)
  showGroupSelectDialog({
    groups: groupsRaw.value,
    groupModCounts: groupModCounts.value,
    onSelect: (groupName: string | null, newName?: string) => {
      if (groupName) {
        // Add to existing group
        addToGroup(fileNames, groupName)
      } else if (newName) {
        // Create new group with custom name
        group(fileNames, newName)
      }
    },
    onApplyShared: () => applySharedGroupRules(),
  })
}

const getContextMenuItems = (proj: ProjectEntry<ModFile>) => {
  const result = [] as ContextMenuItem[]

  const selectMultiple = Object.values(selections.value).filter((v) => v).length > 1

  if (!selectMultiple) {
    result.push(...getContextMenuItemsForGroup(proj, showGroupDialog))
    return result
  }
  const selected = new Set(Object.keys(selections.value).filter((k) => selections.value[k]))
  const files = items.value
    .filter((i) => selected.has(i.id))
    .map((v) => v.installed)
    .flat()
  const allEnabled = files.every((v) => v.enabled)
  const mods = files.map((v) => v.path)
  const text = t('mod.mods', { count: selected.size })
  // delete and disable items
  result.push({
    text: t('delete.name', { name: text }),
    icon: 'delete',
    color: 'error',
    onClick: () => {
      uninstall({ path: path.value, files: mods })
    },
  })
  result.push({
    text: allEnabled ? t('shared.disable') + ' ' + text : t('shared.enable') + ' ' + text,
    icon: allEnabled ? 'flash_off' : 'flash_on',
    color: 'grey',
    onClick: () => {
      if (allEnabled) {
        disable({ path: path.value, files: mods })
      } else {
        enable({ path: path.value, files: mods })
      }
    },
  })
  if (isLocalView.value) {
    result.push({
      text: t('mod.group'),
      icon: 'label',
      onClick: () => {
        showGroupDialog(files.map((v) => v.fileName))
      },
    })
  }
  return result
}

const { t } = useI18n()

// Page compact
const compact = injection(kCompact)
onMounted(() => {
  compact.value = true
})

// Reset all filter
onUnmounted(() => {
  modrinthCategories.value = []
  curseforgeCategory.value = undefined
})

// Drop
const { dragover } = useGlobalDrop({
  onDrop: async (t) => {
    const paths = getDropFilePaths(t.files)
    if (paths.length === 0) return
    await install({ path: path.value, files: paths })
  },
})

// Install modloader wizard
const { onInstallModRuntime, wizardModel, wizardHandleOnEnable, wizardError, wizardModItems } =
  useModWizard()

// modrinth installer
const resolveArtifactDependencies = (url: string | undefined, selectedProjects: Set<string>, loaders: string[]) => {
  const loader = loaders.find((value): value is ArtifactLoader => ['forge', 'neoforge', 'fabric', 'quilt'].includes(value))
  return resolveArtifactModrinthDependencies({
    url,
    loader,
    minecraft: runtime.value.minecraft,
    installedMods: mods.value,
    selectedProjects,
    client: clientModrinthV2,
  })
}

const modrinthInstaller = useModrinthInstaller(
  path,
  runtime,
  mods,
  resolveFromMarket,
  onInstallModRuntime,
  resolveArtifactDependencies,
)
provide(kModrinthInstaller, modrinthInstaller)

// curseforge installer
const curseforgeInstaller = useCurseforgeInstaller(
  path,
  runtime,
  mods,
  resolveFromMarket,
  onInstallModRuntime,
  resolveArtifactDependencies,
)
provide(kCurseforgeInstaller, curseforgeInstaller)

const onInstallProject = useProjectInstall(
  runtime,
  modLoader,
  curseforgeInstaller,
  modrinthInstaller,
  (file) => {
    install({ path: path.value, files: [file.path] })
  },
)

const updateSearch = useDebounceFn(() => {
  const buffer = keywordBuffer.value
  if (buffer) {
    const isSuperQuery = buffer.startsWith('@')
    if (isSuperQuery) {
      const query = buffer.substring(1)
      const isCurseforgeProjectId = /^\d+$/.test(query) && query.length < 10
      const isModrinthProject =
        /^[0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz]+$/.test(query) &&
        query.length === 8
      if (isCurseforgeProjectId) {
        if (route.query.id === `curseforge:${query}`) return
        replace({ query: { ...route.query, id: `curseforge:${query}` } })
      } else if (isModrinthProject) {
        if (route.query.id === `modrinth:${query}`) return
        replace({ query: { ...route.query, id: `modrinth:${query}` } })
      } else {
        if (route.query.keyword === query) return
        replace({ query: { ...route.query, keyword: query } })
      }
    } else {
      if (route.query.keyword === buffer) return
      replace({ query: { ...route.query, keyword: buffer } })
    }
  } else {
    if (route.query.keyword === '') return
    replace({ query: { ...route.query, keyword: '' } })
  }
}, 500)
const keywordBuffer = ref(route.query.keyword as string)

function openModDependent(dependent: ProjectDependent) {
  keywordBuffer.value = ''
  localFilter.value = ''
  replace({ query: { ...route.query, keyword: '', id: dependent.id } })
}

onMounted(() => {
  keywordBuffer.value = (route.query.keyword as string) ?? ''
})

watch(
  keywordBuffer,
  (v, old) => {
    if (v !== old) {
      updateSearch()
    }
  },
  { immediate: true },
)

useTutorial(
  computed(() => [
    {
      element: '#search-text-field',
      popover: {
        title: t('tutorial.mod.searchTitle') + ' (ctrl + f)',
        description: t('tutorial.mod.searchDescription'),
      },
    },
    {
      element: '#left-pane',
      popover: {
        title: t('tutorial.mod.listTitle'),
        description: t('tutorial.mod.listDescription'),
      },
    },
    {
      element: '#right-pane',
      popover: {
        title: t('tutorial.mod.detailTitle'),
        description: t('tutorial.mod.detailDescription'),
      },
    },
  ]),
)
// Presense
usePresence(computed(() => t('presence.mod')))
</script>

<style scoped>
.large-button {
  display: none;
}

.icon-large {
  margin-left: 0px !important;
  margin-right: 0px !important;
}

@container (min-width: 300px) {
  .large-button {
    display: block;
  }

  .icon-large {
    margin-left: -4px !important;
    margin-right: 8px !important;
  }
}
</style>
