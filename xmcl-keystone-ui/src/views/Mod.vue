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
      <v-subheader class="min-h-[46px] w-full py-4 pl-2 pr-6">
        <v-btn
          text
          small
          :input-value="sortBy.startsWith('alpha')"
          @click="onSortClick('alpha')"
        >
          <v-icon>
            sort_by_alpha
          </v-icon>
          <v-icon
            small
            :style="{
              transform: `rotate(${sortBy.endsWith('asc') ? 0 : 180}deg)`,
            }"
          >
            arrow_upward
          </v-icon>
        </v-btn>
        <v-btn
          text
          small
          :input-value="sortBy.startsWith('time')"
          @click="onSortClick('time')"
        >
          <v-icon>
            calendar_month
          </v-icon>
          <v-icon
            small
            :style="{
              transform: `rotate(${sortBy.endsWith('asc') ? 0 : 180}deg)`,
            }"
          >
            arrow_upward
          </v-icon>
        </v-btn>

        <div class="flex-grow" />
        <v-progress-circular
          v-if="checkingUpgrade || checkingDependencies"
          size="20"
          width="2"
          class="mr-2"
          indeterminate
        />
        <v-menu :close-on-content-click="false">
          <template #activator="{ on, attrs }">
            <v-btn
              v-bind="attrs"
              icon
              v-on="on"
            >
              <v-icon>
                more_vert
              </v-icon>
            </v-btn>
          </template>
          <v-card>
            <v-list
              dense
              nav
            >
              <v-list-item
                class="mx-1"
                @click="denseView = !denseView"
              >
                <v-list-item-icon>
                  <v-checkbox
                    v-model="denseView"
                    class="mt-0 pt-0"
                    readonly
                    hide-details
                  />
                </v-list-item-icon>
                <v-list-item-title>
                  {{ t('mod.denseView') }}
                </v-list-item-title>
              </v-list-item>
              <v-list-item
                class="mx-1"
                @click="groupInstalled = !groupInstalled"
              >
                <v-list-item-icon>
                  <v-checkbox
                    v-model="groupInstalled"
                    class="mt-0 pt-0"
                    readonly
                    hide-details
                  />
                </v-list-item-icon>
                <v-list-item-title>
                  {{ t('mod.groupInstalled') }}
                </v-list-item-title>
              </v-list-item>
              <v-divider class="my-2" />
              <v-list-item-group v-model="defaultSourceModel">
                <v-subheader>
                  {{ t('mod.switchDefaultSource') }}
                </v-subheader>
                <v-list-item key="curseforge">
                  <v-list-item-icon>
                    <v-icon>
                      $vuetify.icons.curseforge
                    </v-icon>
                  </v-list-item-icon>
                  <v-list-item-title>
                    Curseforge
                  </v-list-item-title>
                </v-list-item>
                <v-list-item key="modrinth">
                  <v-list-item-icon>
                    <v-icon>
                      $vuetify.icons.modrinth
                    </v-icon>
                  </v-list-item-icon>
                  <v-list-item-title>
                    Modrinth
                  </v-list-item-title>
                </v-list-item>
              </v-list-item-group>
              <v-divider class="my-2" />

              <v-list-item
                dense
                class="mx-1"
                :disabled="mods.length === 0 || checkingDependencies"
                @click="checkDependencies"
              >
                <template v-if="!checkedDependencies">
                  <v-list-item-icon>
                    <v-icon v-if="!checkingDependencies">
                      restart_alt
                    </v-icon>
                    <v-progress-circular
                      v-else
                      small
                      size="22"
                      width="2"
                      indeterminate
                    />
                  </v-list-item-icon>
                  <v-list-item-title class="flex items-center">
                    {{ t('modInstall.checkDependencies') }}
                  </v-list-item-title>
                </template>
                <template v-else>
                  <v-list-item-icon>
                    <v-icon color="primary">
                      check
                    </v-icon>
                  </v-list-item-icon>
                  <v-list-item-title class="flex items-center">
                    {{ t('modInstall.checkedDependencies') }}
                  </v-list-item-title>
                </template>
              </v-list-item>
              <v-list-item
                dense
                class="mx-1"
                :loading="installingDependencies"
                :disabled="dependenciesToUpdate.length === 0"
                @click="installDependencies"
              >
                <v-list-item-icon>
                  <v-icon class="material-icons-outlined">
                    file_download
                  </v-icon>
                </v-list-item-icon>
                <v-list-item-title class="flex items-center">
                  {{ t('modInstall.installDependencies') }}
                </v-list-item-title>
              </v-list-item>
            </v-list>
            <v-divider />
            <v-subheader>
              <template
                v-if="checkedUpgrade"
              >
                <v-icon
                  left
                  color="primary"
                >
                  check
                </v-icon>
                {{ t('modInstall.checkedUpgrade') }}
              </template>
              <template v-else>
                {{ t('modInstall.checkUpgrade') }}
              </template>
            </v-subheader>
            <v-card-text class="pt-2">
              <div>
                {{ t(`modUpgradePolicy.${upgradePolicy}`) }}
              </div>
              <v-btn-toggle
                v-model="upgradePolicy"
                mandatory
                color="primary"
                group
              >
                <v-btn value="modrinth">
                  <v-icon>$vuetify.icons.modrinth</v-icon>
                  <v-icon>$vuetify.icons.curseforge</v-icon>
                </v-btn>
                <v-btn value="curseforge">
                  <v-icon>$vuetify.icons.curseforge</v-icon>
                  <v-icon>$vuetify.icons.modrinth</v-icon>
                </v-btn>

                <v-btn value="modrinthOnly">
                  <v-icon>$vuetify.icons.modrinth</v-icon>
                </v-btn>

                <v-btn value="curseforgeOnly">
                  <v-icon>$vuetify.icons.curseforge</v-icon>
                </v-btn>
              </v-btn-toggle>
              <v-checkbox
                v-model="skipVersion"
                hide-details
                :label="t('modInstall.skipVersion')"
              />
            </v-card-text>
            <v-card-actions>
              <v-btn
                text
                :loading="checkingUpgrade"
                @click="onCheckUpgrade"
              >
                <v-icon left>
                  refresh
                </v-icon>
                {{ t('modInstall.checkUpgrade') }}
              </v-btn>
              <v-spacer />
              <v-btn
                text
                :loading="upgrading"
                :disabled="Object.keys(plans).length === 0"
                @click="upgrade"
              >
                <v-icon left>
                  upgrade
                </v-icon>
                {{ t('modInstall.upgrade') }}
              </v-btn>
            </v-card-actions>
          </v-card>
        </v-menu>
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
        {{ t('mod.duplicatedDetected', { count: Object.keys(conflicted).length }) }}
      </v-alert>
      <v-alert
        v-if="incompatible"
        type="info"
        dense
        class="cursor-pointer info"
        @click="showIncompatibleDialog"
      >
        {{ t('mod.incompatibleHint') }}
      </v-alert>
    </template>
    <template #item="{ item, hasUpdate, checked, selectionMode, selected, on }">
      <ModItem
        v-if="(typeof item === 'object' && 'id' in item)"
        :item="item"
        :indent="!!currentGroup[item.installed?.[0]?.fileName]"
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
        {{ t("modInstall.search") }}
        <v-divider class="ml-4" />
      </v-subheader>
      <v-subheader
        v-else-if="item === 'unsupported'"
        :style="{ height: `${itemHeight}px` }"
      >
        <v-divider class="mr-4" />
        {{ t("modrinth.environments.unsupported") }}
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
          {{ t('mod.noModLoaderHint') }}
        </v-card-title>
        <v-card-text>
          {{ t('mod.modloaderSelectHint') }}
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
              {{ t('mod.modloaderSelectNotSupported', { loader: wizardError.loader, minecraft: wizardError.minecraft }) }}
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
import { useLocalStorageCacheBool, useLocalStorageCacheStringValue } from '@/composables/cache'
import { ContextMenuItem } from '@/composables/contextMenu'
import { kCurseforgeInstaller, useCurseforgeInstaller } from '@/composables/curseforgeInstaller'
import { useDialog } from '@/composables/dialog'
import { useGlobalDrop } from '@/composables/dropHandler'
import { kInstance } from '@/composables/instance'
import { kInstanceDefaultSource } from '@/composables/instanceDefaultSource'
import { kInstanceModsContext } from '@/composables/instanceMods'
import { useModDependenciesCheck } from '@/composables/modDependenciesCheck'
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
import { injection } from '@/util/inject'
import { ModFile } from '@/util/mod'
import { ProjectEntry, ProjectFile } from '@/util/search'
import { InstanceModsServiceKey } from '@xmcl/runtime-api'
import ModDetailOptifine from './ModDetailOptifine.vue'
import ModDetailResource from './ModDetailResource.vue'
import ModDuplicatedDialog from './ModDuplicatedDialog.vue'
import ModGroupEntryItem from './ModGroupEntryItem.vue'
import ModIncompatibileDialog from './ModIncompatibileDialog.vue'
import ModItem from './ModItem.vue'

const { runtime, path } = injection(kInstance)

// Ensure mod search effect is applied
const {
  modrinthError,
  curseforgeError,
  loading,
  loadMoreCurseforge,
  loadMoreModrinth,
  modrinthCategories,
  curseforgeCategory,
  modLoader,
  keyword,
  items,
  gameVersion,
  effect,
} = injection(kModsSearch)

effect()

const error = computed(() => {
  return curseforgeError.value || modrinthError.value
})

const groupInstalled = useLocalStorageCacheBool('mod-group-installed', true)
const sortBy = useLocalStorageCacheStringValue('modSort', '' as '' | 'alpha_asc' | 'alpha_desc' | 'time_asc' | 'time_desc')

const isLocalView = computed(() => {
  return !keyword.value && modrinthCategories.value.length === 0 && curseforgeCategory.value === undefined
})

const { localGroupedItems, groupCollapsedState, renameGroup, ungroup, group, currentGroup, getContextMenuItemsForGroup } = useModGroups(isLocalView, path, items, sortBy)

const groupedItems = computed(() => {
  const result = items.value

  if (isLocalView.value) {
    const sortableEntity = localGroupedItems.value
    const localResult: Array<ProjectEntry<ModFile> | string | ProjectGroup> = []
    for (const i of sortableEntity) {
      if ('projects' in i) {
        localResult.push(markRaw(i))
        if (!groupCollapsedState.value[i.name]) {
          localResult.push(...i.projects)
        }
      } else {
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
    ...(supported.length > 0 ? ['search' as string, ...supported] : []),
    ...(unsupported.length > 0 ? ['unsupported' as string, ...unsupported] : []),
  ]
})


const isModProject = (v: ProjectEntry<ProjectFile> | undefined): v is (ProjectEntry<ModFile> & { files: ModFile[] }) =>
  !!v?.files
const isOptifineProject = (v: ProjectEntry<ProjectFile> | undefined): v is ProjectEntry<ModFile> =>
  v?.id === 'OptiFine'

// Upgrade
const { plans, error: upgradeError, refresh: checkUpgrade, refreshing: checkingUpgrade, checked: checkedUpgrade, upgrade, upgrading } = injection(kModUpgrade)
const skipVersion = useLocalStorageCacheBool(computed(() => `modsUpgradeSkipVersion:${path.value}`), false)
const upgradePolicy = useLocalStorageCacheStringValue(computed(() => `modsUpgradePolicy:${path.value}`), 'modrinth')
function onCheckUpgrade() {
  const policy = upgradePolicy.value as any
  checkUpgrade({
    skipVersion: skipVersion.value,
    policy,
  })
}

// Dependencies check
const { updates: dependenciesToUpdate, refresh: checkDependencies, refreshing: checkingDependencies, checked: checkedDependencies, apply: installDependencies, installing: installingDependencies } = useModDependenciesCheck(path, runtime)

const updateErrorMessage = computed(() => {
  if (upgradeError) return (upgradeError.value as any).message
  // if (modrinthError.value) return modrinthError.value.message
  // if (curseforgeError.value) return curseforgeError.value.message
  return ''
})

const defaultSource = injection(kInstanceDefaultSource)
// Default source
const defaultSourceModel = computed({
  get() { return defaultSource.value === 'curseforge' ? 0 : 1 },
  set(i: number) { defaultSource.value = i === 0 ? 'curseforge' : 'modrinth' },
})
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

const { mods, conflicted, revalidate, incompatible } = injection(kInstanceModsContext)

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

const onLoad = () => {
  loadMoreCurseforge()
  loadMoreModrinth()
}

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
const denseView = useLocalStorageCacheBool('mod-dense-view', false)
function onSortClick(type: 'alpha' | 'time') {
  if (sortBy.value === type + '_asc') {
    sortBy.value = type + '_desc' as any
  } else {
    sortBy.value = type + '_asc' as any
  }
}
const itemHeight = computed(() => denseView.value ? 40 : 91)
const selections = ref({} as Record<string, boolean>)

provide('selections', selections)
// Clear selection when group changed
watch(currentGroup, () => {
  selections.value = {}
})

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
