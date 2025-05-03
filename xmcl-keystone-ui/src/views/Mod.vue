<template>
  <MarketBase
    :plans="plans"
    :items="groupedItems"
    :selection-mode="true"
    :item-height="itemHeight"
    :loading="loading"
    :error="error"
    :class="{
      dragover,
    }"
    @load="onLoad"
  >
    <template #actions>
      <v-subheader class="flex gap-1">
        {{ t('mod.mods', { count: items.length }) }}
        <v-spacer />

        <v-btn
          id="default-source-button"
          v-shared-tooltip="_ => t('mod.switchDefaultSource') + ' ' + defaultSource"
          icon
          @click="defaultSource = defaultSource === 'curseforge' ? 'modrinth' : 'curseforge'"
        >
          <v-icon> {{ defaultSource === 'modrinth' ? '$vuetify.icons.modrinth' : '$vuetify.icons.curseforge' }} </v-icon>
        </v-btn>
        <v-btn
          v-shared-tooltip="_ => t('mod.groupInstalled')"
          :class="{'v-list-item--active': groupInstalled}"
          icon
          @click="groupInstalled = !groupInstalled"
        >
          <v-icon> layers </v-icon>
        </v-btn>
        <v-btn
          v-shared-tooltip="_ => t('mod.denseView')"
          icon
          @click="denseView = !denseView"
        >
          <v-icon> {{ denseView ? 'reorder' : 'list' }} </v-icon>
        </v-btn>
      </v-subheader>
      <v-alert
        v-if="upgradeError"
        dense
        type="error"
      >
        {{ updateErrorMessage }}
      </v-alert>
      <v-alert
        v-if="Object.keys(conflicted).length > 0"
        dense
        class="cursor-pointer error"
        type="error"
        @click="showDuplicatedDialog"
      >
        {{ localizedTexts.mod.duplicatedDetected }}
      </v-alert>
    </template>
    <template #item="{ item, hasUpdate, checked, selectionMode, selected, on }">
      <ModItem
        v-if="(typeof item === 'object' && 'id' in item)"
        :item="item"
        :indent="!!isInGroup(item.installed?.[0]?.fileName)"
        :indent-color="getGroupColor(item.installed?.[0]?.fileName)"
        :item-height="itemHeight"
        :has-update="hasUpdate"
        :checked="checked"
        :selection-mode="selectionMode"
        :selected="selected"
        :install="onInstallProject"
        :dense="denseView"
        :get-context-menu-items="getContextMenuItems"
        @click="on.click"
      />
      <ModGroupEntryItem
        v-else-if="(typeof item === 'object')"
        :items="item.projects"
        :height="itemHeight"
        :name="item.name"
        :expanded="!groupCollapsedState[item.name]"
        :dense="denseView"
        @ungroup="ungroup(item.name)"
        @expand="groupCollapsedState = { ...groupCollapsedState, [item.name]: $event }"
        @setting="renameGroup(item.name, $event.name)"
      />
      <v-subheader
        v-else-if="item === 'search'"
        :style="{ height: `${itemHeight}px` }"
      >
        <v-divider class="mr-4" />
        <!-- {{ t("modInstall.search") }} -->
        {{ localizedTexts.mod.search }}
        <v-divider class="ml-4" />
      </v-subheader>
      <v-subheader
        v-else-if="item === 'unsupported'"
        :style="{ height: `${itemHeight}px` }"
      >
        <v-divider class="mr-4" />
        <!-- {{ t("modrinth.environments.unsupported") }} -->
        {{ localizedTexts.mod.unsupported }}
        <v-divider class="ml-4" />
      </v-subheader>
    </template>
    <template #placeholder>
      <Hint
        :text="t('modInstall.searchHint')"
        icon="playlist_add"
      />
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
        :installed="selectedItem?.installed || getInstalledModrinth(selectedModrinthId)"
        :loader="modLoader"
        :categories="modrinthCategories"
        :all-files="mods"
        :updating="updating"
        :game-version="gameVersion"
        :curseforge="selectedItem?.curseforge?.id || selectedCurseforgeId"
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
        :updating="updating"
        :modrinth="selectedModrinthId"
        @uninstall="onUninstall"
        @enable="onEnable"
        @disable="onDisable"
        @category="curseforgeCategory = $event"
      />
      <ModDetailOptifine
      v-else-if="isOptifineProject(selectedItem)"
        :key="selectedItem.id"
        :mod="selectedItem"
        :runtime="runtime"
      />
      <ModDetailResource
        v-else-if="isModProject(selectedItem)"
        :key="selectedItem.id"
        :mod="selectedItem"
        :files="selectedItem.files"
        :runtime="runtime"
        :installed="selectedItem.installed"
      />
      <MarketRecommendation
        v-else
        key="recommendation"
        curseforge="mc-mods"
        modrinth="mod"
        @modrinth="modrinthCategories.push($event.name)"
        @curseforge="curseforgeCategory = $event.id"
      />
    </template>
    <v-dialog
      v-model="wizardModel"
      width="600"
    >
      <v-card>
        <v-card-title>
          <!-- {{ t('mod.noModLoaderHint') }} -->
          {{ localizedTexts.mod.noModLoaderHint }}
        </v-card-title>
        <v-card-text>
          <!-- {{ t('mod.modloaderSelectHint') }} -->
          {{ localizedTexts.mod.modloaderSelectHint }}
          <v-list nav>
            <v-list-item
              v-for="i of wizardModItems"
              :key="i.title"
              @click="i.onSelect"
            >
              <v-list-item-avatar>
                <img :src="i.icon">
              </v-list-item-avatar>
              <v-list-item-content>
                <v-list-item-title>
                  {{ i.title }}
                </v-list-item-title>
                <v-list-item-subtitle>
                  <a
                    :href="i.url"
                    @click.stop
                  >{{ i.url }}</a>
                </v-list-item-subtitle>
              </v-list-item-content>
            </v-list-item>
          </v-list>
          <v-alert
            v-if="wizardError"
            type="error"
          >
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

<script lang=ts setup>
import Hint from '@/components/Hint.vue'
import MarketBase from '@/components/MarketBase.vue'
import MarketProjectDetailCurseforge from '@/components/MarketProjectDetailCurseforge.vue'
import MarketProjectDetailModrinth from '@/components/MarketProjectDetailModrinth.vue'
import MarketRecommendation from '@/components/MarketRecommendation.vue'
import { useService } from '@/composables'
import { ContextMenuItem } from '@/composables/contextMenu'
import { kCurseforgeInstaller, useCurseforgeInstaller } from '@/composables/curseforgeInstaller'
import { useDialog } from '@/composables/dialog'
import { useGlobalDrop } from '@/composables/dropHandler'
import { kInstance } from '@/composables/instance'
import { kInstanceDefaultSource } from '@/composables/instanceDefaultSource'
import { kInstanceModsContext } from '@/composables/instanceMods'
import { ProjectGroup, useModGroups } from '@/composables/modGroup'
import { kModsSearch } from '@/composables/modSearch'
import { kModUpgrade } from '@/composables/modUpgrade'
import { useModWizard } from '@/composables/modWizard'
import { kModrinthInstaller, useModrinthInstaller } from '@/composables/modrinthInstaller'
import { usePresence } from '@/composables/presence'
import { useProjectInstall } from '@/composables/projectInstall'
import { kCompact } from '@/composables/scrollTop'
import { useToggleCategories } from '@/composables/toggleCategories'
import { useTutorial } from '@/composables/tutorial'
import { vSharedTooltip } from '@/directives/sharedTooltip'
import { injection } from '@/util/inject'
import { ModFile } from '@/util/mod'
import { ProjectEntry, ProjectFile } from '@/util/search'
import { InstanceModsServiceKey } from '@xmcl/runtime-api'
import debounce from 'lodash.debounce'
import ModDetailOptifine from './ModDetailOptifine.vue'
import ModDetailResource from './ModDetailResource.vue'
import ModDuplicatedDialog from './ModDuplicatedDialog.vue'
import ModGroupEntryItem from './ModGroupEntryItem.vue'
import ModIncompatibileDialog from './ModIncompatibileDialog.vue'
import ModItem from './ModItem.vue'
import { kModDependenciesCheck } from '@/composables/modDependenciesCheck'
import { kModLibCleaner } from '@/composables/modLibCleaner'
import { basename } from '@/util/basename'
import { kSearchModel } from '@/composables/search'

const localizedTexts = computed(() => markRaw({
  mod: {
    mods: t('mod.mods'),
    group: t('mod.group'),
    delete: {
      name: t('delete.name'),
    },
    enable: t('enable'),
    disable: t('disable'),
    denseView: t('mod.denseView'),
    groupInstalled: t('mod.groupInstalled'),
    switchDefaultSource: t('mod.switchDefaultSource'),
    checkDependencies: t('modInstall.checkDependencies'),
    checkedDependencies: t('modInstall.checkedDependencies'),
    installDependencies: t('modInstall.installDependencies'),
    scanUnusedLibraries: t('modInstall.scanUnusedLibraries'),
    removeUnusedLibraries: t('modInstall.removeUnusedLibraries'),
    checkUpgrade: t('modInstall.checkUpgrade'),
    checkedUpgrade: t('modInstall.checkedUpgrade'),
    upgrade: t('modInstall.upgrade'),
    skipVersion: t('modInstall.skipVersion'),
    noModLoaderHint: t('mod.noModLoaderHint'),
    modloaderSelectHint: t('mod.modloaderSelectHint'),
    modloaderSelectNotSupported: t('mod.modloaderSelectNotSupported'),
    duplicatedDetected: t('mod.duplicatedDetected'),
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
}))

const { runtime, path } = injection(kInstance)

const { keyword, modrinthCategories, curseforgeCategory, modLoader, gameVersion, currentView } = injection(kSearchModel)

// Ensure mod search effect is applied
const {
  error,
  loading,
  items,
  effect,
  denseView,
  sortBy,
  groupInstalled,
  localFilter,
  loadMore,
} = injection(kModsSearch)

effect()

const { effect: onDependenciesEffect, installation } = injection(kModDependenciesCheck)
onDependenciesEffect()

const { unusedMods } = injection(kModLibCleaner)

const isLocalView = computed(() => {
  return currentView.value === 'local'
})

const { localGroupedItems, groupCollapsedState, renameGroup, ungroup, group, isInGroup, getGroupColor, getContextMenuItemsForGroup } = useModGroups(isLocalView, path, items, sortBy)

function isIncompatible(p: ProjectEntry<ModFile>) {
  const modId = p.installed?.[0]?.modId
  if (!modId) {
    return false
  }
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

const groupedItems = computed(() => {
  const result = items.value

  const installationSet = new Set(installation.value.map(([_, file]) => basename(file.path)))
  const unusedSet = new Set(unusedMods.value.map((file) => basename(file.path, '/')))

  if (isLocalView.value) {
    const sortableEntity = localGroupedItems.value
    const localResult: Array<ProjectEntry<ModFile> | string | ProjectGroup> = []
    for (const i of sortableEntity) {
      if ('projects' in i) {
        localResult.push(markRaw(i))
        if (!groupCollapsedState.value[i.name]) {
          for (const p of i.projects) {
            if (localFilter.value === 'disabledOnly' && !p.disabled) {
              continue
            }
            if (localFilter.value === 'incompatibleOnly' && !isIncompatible(p)) {
              continue
            }
            if (localFilter.value === 'hasUpdateOnly' && !plans.value[p.id]) {
              continue
            }
            if (p.installed[0] && localFilter.value === 'dependenciesInstallOnly' && !installationSet.has(basename(p.installed[0].path))) {
              continue
            }
            if (p.installed[0] && localFilter.value === 'unusedOnly' && !unusedSet.has(basename(p.installed[0].path))) {
              continue
            }
            localResult.push(p)
          }
        }
      } else {
        if (localFilter.value === 'disabledOnly' && !i.disabled) {
          continue
        }
        if (localFilter.value === 'incompatibleOnly' && !isIncompatible(i)) {
          continue
        }
        if (localFilter.value === 'hasUpdateOnly' && !plans.value[i.id]) {
          continue
        }
        if (localFilter.value === 'dependenciesInstallOnly' && i.installed[0] && !installationSet.has(basename(i.installed[0].path))) {
          continue
        }
        if (localFilter.value === 'unusedOnly' && i.installed[0] && !unusedSet.has(basename(i.installed[0].path))) {
          continue
        }
        localResult.push(i)
      }
    }

    return localResult
  }

  const transformed: Array<ProjectEntry<ModFile> | string> = []
  let rest = result

  if (groupInstalled.value) {
    const [installed, uninstalled] = rest.reduce((acc, i) => {
      if (i.installed.length > 0) {
        acc[0].push(i)
      } else {
        acc[1].push(i)
      }
      return acc
    }, [[], []] as [ProjectEntry<ModFile>[], ProjectEntry<ModFile>[]])
    transformed.push(...installed)
    rest = uninstalled
  }

  const [supported, unsupported] = rest.reduce((acc, i) => {
    if (!i.unsupported) {
      acc[0].push(i)
    } else {
      acc[1].push(i)
    }
    return acc
  }, [[], []] as [ProjectEntry<ModFile>[], ProjectEntry<ModFile>[]])

  return [
    ...transformed,
    ...(supported.length > 0 ? ['search', ...supported] : []),
    ...(unsupported.length > 0 ? ['unsupported' as string, ...unsupported] : []),
  ]
})

const isModProject = (v: ProjectEntry<ProjectFile> | undefined): v is (ProjectEntry<ModFile> & { files: ModFile[] }) =>
  !!v?.files
const isOptifineProject = (v: ProjectEntry<ProjectFile> | undefined): v is ProjectEntry<ModFile> =>
  v?.id === 'OptiFine'

// Upgrade
const { plans, error: upgradeError } = injection(kModUpgrade)

const updateErrorMessage = computed(() => {
  if (upgradeError) return (upgradeError.value as any).message
  return ''
})

const defaultSource = injection(kInstanceDefaultSource)
const shouldShowModrinth = (selectedItem: undefined | ProjectEntry, selectedModrinthId: string, selectedCurseforgeId: number | undefined) => {
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
const shouldShowCurseforge = (selectedItem: undefined | ProjectEntry, selectedModrinthId: string, selectedCurseforgeId: number | undefined) => {
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

const { mods, conflicted, revalidate, incompatible, compatibility } = injection(kInstanceModsContext)

const { show: showDuplicatedDialog } = useDialog('mod-duplicated')
const { show: showIncompatibleDialog } = useDialog('mod-incompatible')

const getInstalledModrinth = (projectId: string) => {
  return mods.value.filter((m) => m.modrinth?.projectId === projectId)
}
const getInstalledCurseforge = (modId: number | undefined) => {
  return mods.value.filter((m) => m.curseforge?.projectId === modId)
}

const route = useRoute()
watch(computed(() => route.fullPath), () => {
  keyword.value = route.query.keyword as string ?? ''
}, { immediate: true })

const onLoad = loadMore

// install / uninstall / enable / disable
const { install, uninstall, enable, disable, installFromMarket } = useService(InstanceModsServiceKey)
const onUninstall = (f: ProjectFile[], _path?: string) => {
  uninstall({ path: _path ?? path.value, mods: f.map(f => f.path) }).then(() => {
    setTimeout(revalidate, 1500)
  })
}
const onEnable = async (f: ProjectFile, _path?: string) => {
  if (await wizardHandleOnEnable(f as ModFile, _path || path.value)) {
    return
  }
  enable({ path: _path ?? path.value, mods: [f.path] }).then(() => {
    setTimeout(revalidate, 1500)
  })
}
const onDisable = (f: ProjectFile, _path?: string) => {
  disable({ path: _path ?? path.value, mods: [f.path] }).then(() => {
    setTimeout(revalidate, 1500)
  })
}

// Categories
const toggleCategory = useToggleCategories(modrinthCategories)

// View
const itemHeight = computed(() => denseView.value ? 40 : 90)
const selections = ref({} as Record<string, boolean>)

provide('selections', selections)

const getContextMenuItems = (proj: ProjectEntry<ModFile>) => {
  const result = [] as ContextMenuItem[]

  const selectMultiple = Object.values(selections.value).filter(v => v).length > 1

  if (!selectMultiple) {
    result.push(...getContextMenuItemsForGroup(proj))
    return result
  }
  const selected = new Set(Object.keys(selections.value).filter((k) => selections.value[k]))
  const files = items.value.filter(i => selected.has(i.id)).map(v => v.installed).flat()
  const allEnabled = files.every(v => v.enabled)
  const mods = files.map(v => v.path)
  const text = t('mod.mods', { count: selected.size })
  // delete and disable items
  result.push({
    text: t('delete.name', { name: text }),
    icon: 'delete',
    color: 'error',
    onClick: () => {
      uninstall({ path: path.value, mods })
    },
  })
  result.push({
    text: allEnabled ? t('disable') + ' ' + text : t('enable') + ' ' + text,
    icon: allEnabled ? 'flash_off' : 'flash_on',
    color: 'grey',
    onClick: () => {
      if (allEnabled) {
        disable({ path: path.value, mods })
      } else {
        enable({ path: path.value, mods })
      }
    },
  })
  if (isLocalView.value) {
    result.push({
      text: t('mod.group'),
      icon: 'label',
      onClick: () => {
        group(files.map(v => v.fileName))
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
    const paths = [] as string[]
    for (const f of t.files) {
      paths.push(f.path)
    }
    await install({ path: path.value, mods: paths })
  },
})

// Install modloader wizard
const { onInstallModRuntime, wizardModel, wizardHandleOnEnable, wizardError, wizardModItems } = useModWizard()

// modrinth installer
const modrinthInstaller = useModrinthInstaller(
  path,
  runtime,
  mods,
  installFromMarket,
  onUninstall,
  onInstallModRuntime,
)
provide(kModrinthInstaller, modrinthInstaller)

// curseforge installer
const curseforgeInstaller = useCurseforgeInstaller(
  path,
  runtime,
  mods,
  installFromMarket,
  onUninstall,
  onInstallModRuntime,
)
provide(kCurseforgeInstaller, curseforgeInstaller)

const onInstallProject = useProjectInstall(
  runtime,
  modLoader,
  curseforgeInstaller,
  modrinthInstaller,
  (file) => {
    install({ path: path.value, mods: [file.path] })
  },
)

const updateSearch = debounce(() => {
  const buffer = keywordBuffer.value
  if (buffer) {
    const isSuperQuery = buffer.startsWith('@')
    if (isSuperQuery) {
      const query = buffer.substring(1)
      const isCurseforgeProjectId = /^\d+$/.test(query) && query.length < 10
      const isModrinthProject = /^[0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz]+$/.test(query) && query.length === 8
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
const { replace } = useRouter()
const keywordBuffer = ref(route.query.keyword as string)
onMounted(() => {
  keywordBuffer.value = route.query.keyword as string ?? ''
})

watch(keywordBuffer, (v, old) => {
  if (v !== old) {
    updateSearch()
  }
}, { immediate: true })


useTutorial(computed(() => [{
  element: '#search-text-field',
  popover: {
    title: t('tutorial.mod.searchTitle') + ' (ctrl + f)',
    description: t('tutorial.mod.searchDescription'),
  },
}, {
  element: '#left-pane',
  popover: {
    title: t('tutorial.mod.listTitle'),
    description: t('tutorial.mod.listDescription'),
  },
}, {
  element: '#right-pane',
  popover: {
    title: t('tutorial.mod.detailTitle'),
    description: t('tutorial.mod.detailDescription'),
  },
}, {
  element: '#default-source-button',
  popover: {
    title: t('tutorial.mod.defaultSourceTitle'),
    description: t('tutorial.mod.defaultSourceDescription'),
  },
}]))
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
