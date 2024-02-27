<template>
  <MarketBase
    :plans="plans"
    :items="groupedItems"
    :item-height="91"
    :loading="loading"
    :error="error"
    :class="{
      dragover,
    }"
    @load="onLoad"
  >
    <template #actions>
      <v-subheader
        v-if="isLocalView"
        class="responsive-header py-2 pl-0"
      >
        <v-btn
          text
          small
          :disabled="mods.length === 0"
          :loading="checkingUpgrade"
          @click="checkUpgrade"
        >
          <template v-if="!checkedUpgrade">
            <v-icon left>
              refresh
            </v-icon>
            <span>
              {{ t('modInstall.checkUpgrade') }}
            </span>
          </template>
          <template v-else>
            <v-icon
              color="primary"
              left
            >
              check
            </v-icon>
            <span>
              {{ t('modInstall.checkedUpgrade') }}
            </span>
          </template>
        </v-btn>
        <div class="flex-grow" />

        <v-btn
          text
          small
          :disabled="Object.keys(plans).length === 0"
          :loading="upgrading"
          @click="upgrade"
        >
          <v-icon left>
            upgrade
          </v-icon>
          <span>
            {{ t('modInstall.upgrade') }}
          </span>
        </v-btn>
      </v-subheader>
      <v-subheader
        v-else
        class="responsive-header px-0 py-2"
      >
        <div class="flex-grow" />
        <v-checkbox
          v-model="groupInstalled"
          :label="t('mod.groupInstalled')"
        />
      </v-subheader>
    </template>
    <template #item="{ item, hasUpdate, checked, selectionMode, selected, on }">
      <ModItem
        v-if="(typeof item === 'object')"
        :item="item"
        :has-update="hasUpdate"
        :checked="checked"
        :selection-mode="selectionMode"
        :selected="selected"
        :install="onInstallProject"
        @click="on.click"
      />
      <v-subheader
        v-if="typeof item === 'string'"
        class="h-[91px]"
      >
        <v-divider class="mr-4" />
        {{ t("modInstall.search") }}
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
        icon="save_alt"
        :text="t('mod.dropHint')"
        class="h-full"
      />
      <MarketProjectDetailModrinth
        v-else-if="shouldShowModrinth(selectedItem, selectedModrinthId, selectedCurseforgeId)"
        :modrinth="selectedItem?.modrinth"
        :project-id="selectedModrinthId"
        :installed="selectedItem?.installed || getInstalledModrinth(selectedModrinthId)"
        :loaders="modLoaderFilters"
        :categories="modrinthCategories"
        :runtime="runtime"
        :all-files="mods"
        :updating="updating"
        :curseforge="selectedItem?.curseforge?.id || selectedCurseforgeId"
        @install="onInstall"
        @uninstall="onUninstall"
        @enable="onEnable"
        @disable="onDisable"
        @category="toggleCategory"
      />
      <MarketProjectDetailCurseforge
        v-else-if="shouldShowCurseforge(selectedItem, selectedModrinthId, selectedCurseforgeId)"
        :curseforge="selectedItem?.curseforge"
        :curseforge-id="Number(selectedCurseforgeId)"
        :installed="selectedItem?.installed || getInstalledCurseforge(selectedCurseforgeId)"
        :loaders="modLoaderFilters"
        :runtime="runtime"
        :category="curseforgeCategory"
        :all-files="mods"
        :updating="updating"
        :modrinth="selectedItem?.modrinth?.project_id || selectedModrinthId"
        @install="onInstall"
        @uninstall="onUninstall"
        @enable="onEnable"
        @disable="onDisable"
        @category="curseforgeCategory = $event"
      />
      <ModDetailOptifine
        v-else-if="isOptifineProject(selectedItem)"
        :mod="selectedItem"
        :runtime="runtime"
      />
      <ModDetailResource
        v-else-if="isModProject(selectedItem)"
        :mod="selectedItem"
        :files="selectedItem.files"
        :runtime="runtime"
        :installed="selectedItem.installed"
      />
      <Hint
        v-else
        :text="t('modInstall.searchHint')"
        icon="playlist_add"
      />
    </template>
  </MarketBase>
</template>

<script lang=ts setup>
import Hint from '@/components/Hint.vue'
import MarketBase from '@/components/MarketBase.vue'
import MarketProjectDetailCurseforge from '@/components/MarketProjectDetailCurseforge.vue'
import MarketProjectDetailModrinth from '@/components/MarketProjectDetailModrinth.vue'
import { useService } from '@/composables'
import { useLocalStorageCacheBool } from '@/composables/cache'
import { kCurseforgeInstaller, useCurseforgeInstaller } from '@/composables/curseforgeInstaller'
import { useDrop } from '@/composables/dropHandler'
import { kInstance } from '@/composables/instance'
import { kInstanceDefaultSource } from '@/composables/instanceDefaultSource'
import { kInstanceModsContext } from '@/composables/instanceMods'
import { kModsSearch } from '@/composables/modSearch'
import { kModUpgrade } from '@/composables/modUpgrade'
import { kModrinthInstaller, useModrinthInstaller } from '@/composables/modrinthInstaller'
import { usePresence } from '@/composables/presence'
import { useProjectInstall } from '@/composables/projectInstall'
import { kCompact } from '@/composables/scrollTop'
import { useToggleCategories } from '@/composables/toggleCategories'
import { useTutorial } from '@/composables/tutorial'
import { injection } from '@/util/inject'
import { ModFile } from '@/util/mod'
import { ProjectEntry, ProjectFile } from '@/util/search'
import { InstanceModsServiceKey, Resource, ResourceDomain, ResourceServiceKey } from '@xmcl/runtime-api'
import ModDetailOptifine from './ModDetailOptifine.vue'
import ModDetailResource from './ModDetailResource.vue'
import ModItem from './ModItem.vue'

const { runtime, path } = injection(kInstance)

const {
  modrinthError,
  curseforgeError,
  loading,
  loadMoreCurseforge,
  loadMoreModrinth,
  modrinthCategories,
  curseforgeCategory,
  modLoaderFilters,
  keyword,
  items,
} = injection(kModsSearch)

const error = computed(() => {
  return curseforgeError.value || modrinthError.value
})

const groupInstalled = useLocalStorageCacheBool('mod-group-installed', true)

const groupedItems = computed(() => {
  const result = items.value

  if (isLocalView.value) return result

  if (!groupInstalled.value) return result

  const installed = result.filter((i) => i.installed.length > 0)

  if (installed.length === 0) return result

  const notInstalled = result.filter((i) => i.installed.length === 0)
  return [
    ...installed,
    'search' as string,
    ...notInstalled,
  ]
})

const isLocalView = computed(() => {
  return !keyword.value && modrinthCategories.value.length === 0 && curseforgeCategory.value === undefined
})

const isModProject = (v: ProjectEntry<ProjectFile> | undefined): v is (ProjectEntry<ModFile> & { files: ModFile[] }) =>
  !!v?.files
const isOptifineProject = (v: ProjectEntry<ProjectFile> | undefined): v is ProjectEntry<ModFile> =>
  v?.id === 'OptiFine'

const { plans, refresh: checkUpgrade, refreshing: checkingUpgrade, checked: checkedUpgrade, upgrade, upgradeError, upgrading } = injection(kModUpgrade)

const defaultSource = injection(kInstanceDefaultSource)
const shouldShowModrinth = (selectedItem: undefined | ProjectEntry, selectedModrinthId: string, selectedCurseforgeId: number | undefined) => {
  const hasModrinth = selectedItem?.modrinth || selectedModrinthId
  if (!hasModrinth) return false
  const hasCurseforge = selectedItem?.curseforge || selectedCurseforgeId
  if (defaultSource.value === 'curseforge' && hasCurseforge) {
    return false
  }
  return true
}
const shouldShowCurseforge = (selectedItem: undefined | ProjectEntry, selectedModrinthId: string, selectedCurseforgeId: number | undefined) => {
  const hasCurseforge = selectedItem?.curseforge || selectedCurseforgeId
  if (!hasCurseforge) return false
  const hasModrinth = selectedItem?.modrinth || selectedModrinthId
  if (defaultSource.value === 'modrinth' && hasModrinth) {
    return false
  }
  return true
}

const { mods } = injection(kInstanceModsContext)
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
const { install, uninstall, enable, disable } = useService(InstanceModsServiceKey)
const onInstall = (f: Resource[]) => {
  install({ path: path.value, mods: f })
}
const onUninstall = (f: ProjectFile[]) => {
  uninstall({ path: path.value, mods: f.map(f => f.resource) })
}
const onEnable = (f: ProjectFile) => {
  enable({ path: path.value, mods: [f.resource] })
}
const onDisable = (f: ProjectFile) => {
  disable({ path: path.value, mods: [f.resource] })
}

// Categories
const toggleCategory = useToggleCategories(modrinthCategories)

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
const { resolveResources } = useService(ResourceServiceKey)
const { dragover } = useDrop(() => { }, async (t) => {
  const paths = [] as string[]
  for (const f of t.files) {
    paths.push(f.path)
  }
  const resources = await resolveResources(paths.map(p => ({ path: p, domain: ResourceDomain.Mods })))
  await install({ path: path.value, mods: resources })
}, () => { })

// modrinth installer
const modrinthInstaller = useModrinthInstaller(
  path,
  runtime,
  mods,
  onInstall,
  onUninstall,
)
provide(kModrinthInstaller, modrinthInstaller)

// curseforge installer
const curseforgeInstaller = useCurseforgeInstaller(
  path,
  runtime,
  mods,
  onInstall,
  onUninstall,
  'mc-mods',
)
provide(kCurseforgeInstaller, curseforgeInstaller)

const onInstallProject = useProjectInstall(
  runtime,
  modLoaderFilters,
  curseforgeInstaller,
  modrinthInstaller,
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
.search-text {
  display: none;
}

@container (min-width: 260px) {
  .search-text {
    display: block;
  }
}

.responsive-header {
  container-type: size;
  width: 100%;
}
</style>
