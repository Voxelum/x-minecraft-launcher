<template>
  <MarketBase
    :items="items"
    :item-height="itemHeight"
    :plans="{}"
    :class="{
      dragover,
    }"
    :error="error"
    :loading="loading"
    @load="onLoad"
  >
    <template #item="{ item, hasUpdate, checked, selectionMode, selected, on, index }">
      <v-subheader
        v-if="typeof item === 'string'"
        class="flex"
        :style="{ height: itemHeight + 'px' }"
      >
        {{
          item === 'enabled' ? t("resourcepack.selected") :
          item === 'disabled' ? t("resourcepack.unselected") :
          t("modInstall.search")
        }}
        <div class="flex-grow" />
        <v-btn
          v-if="index === 0"
          v-shared-tooltip="_ => t('mod.denseView')"
          icon
          @click="denseView = !denseView"
        >
          <v-icon> {{ denseView ? 'reorder' : 'list' }} </v-icon>
        </v-btn>
      </v-subheader>
      <ResourcePackItem
        v-else-if="(typeof item === 'object')"
        :pack="item"
        :dense="denseView"
        :draggable="currentView === 'local' && !item.disabled"
        :selection-mode="selectionMode"
        :item-height="itemHeight"
        :selected="selected"
        :has-update="hasUpdate"
        :checked="checked"
        :install="onInstallProject"
        @drop="onDrop(item, $event)"
        @click="on.click"
      />
    </template>
    <template #content="{ selectedModrinthId, selectedItem, selectedCurseforgeId }">
      <Hint
        v-if="dragover"
        icon="save_alt"
        :text="t('resourcepack.dropHint')"
        class="h-full"
      />
      <MarketProjectDetailModrinth
        v-else-if="selectedItem?.modrinth || selectedModrinthId"
        :modrinth="selectedItem?.modrinth"
        :project-id="selectedModrinthId"
        :installed="selectedItem?.installed || getInstalledModrinth(selectedItem?.modrinth?.project_id || selectedModrinthId)"
        :game-version="gameVersion"
        :categories="modrinthCategories"
        :all-files="files"
        :curseforge="selectedItem?.curseforge?.id || selectedCurseforgeId"
        @uninstall="onUninstall"
        @enable="onEnable"
        @disable="onDisable"
        @category="toggleCategory"
      />
      <MarketProjectDetailCurseforge
        v-else-if="selectedItem?.curseforge || selectedCurseforgeId"
        :curseforge="selectedItem?.curseforge"
        :curseforge-id="Number(selectedItem?.curseforge?.id || selectedCurseforgeId)"
        :installed="selectedItem?.installed || getInstalledCurseforge(Number(selectedItem?.curseforge?.id || selectedCurseforgeId))"
        :game-version="gameVersion"
        :category="curseforgeCategory"
        :all-files="files"
        :modrinth="selectedItem?.modrinth?.project_id || selectedModrinthId"
        @uninstall="onUninstall"
        @enable="onEnable"
        @disable="onDisable"
        @category="curseforgeCategory = $event"
      />
      <ResourcePackDetailResource
        v-else-if="isLocalFile(selectedItem)"
        :resource-pack="selectedItem"
        :installed="selectedItem.installed"
        :runtime="runtime"
      />
      <MarketRecommendation
        v-else
        curseforge="texture-packs"
        modrinth="resourcepack"
        @modrinth="modrinthCategories.push($event.name)"
        @curseforge="curseforgeCategory = $event.id"
      />
    </template>
    <SimpleDialog :title="t('resourcepack.delete.title')">
      {{ t('resourcepack.delete.content') }}
    </SimpleDialog>
  </MarketBase>
</template>

<script lang=ts setup>
import Hint from '@/components/Hint.vue'
import MarketBase from '@/components/MarketBase.vue'
import MarketProjectDetailCurseforge from '@/components/MarketProjectDetailCurseforge.vue'
import MarketProjectDetailModrinth from '@/components/MarketProjectDetailModrinth.vue'
import MarketRecommendation from '@/components/MarketRecommendation.vue'
import SimpleDialog from '@/components/SimpleDialog.vue'
import { useService } from '@/composables'
import { useLocalStorageCacheBool } from '@/composables/cache'
import { kCurseforgeInstaller, useCurseforgeInstaller } from '@/composables/curseforgeInstaller'
import { useGlobalDrop } from '@/composables/dropHandler'
import { kInstance } from '@/composables/instance'
import { InstanceResourcePack, kInstanceResourcePacks } from '@/composables/instanceResourcePack'
import { kModrinthInstaller, useModrinthInstaller } from '@/composables/modrinthInstaller'
import { usePresence } from '@/composables/presence'
import { useProjectInstall } from '@/composables/projectInstall'
import { ResourcePackProject, kResourcePackSearch } from '@/composables/resourcePackSearch'
import { kCompact } from '@/composables/scrollTop'
import { useToggleCategories } from '@/composables/toggleCategories'
import { vSharedTooltip } from '@/directives/sharedTooltip'
import { injection } from '@/util/inject'
import { ProjectEntry, ProjectFile } from '@/util/search'
import { InstanceResourcePacksServiceKey } from '@xmcl/runtime-api'
import ResourcePackDetailResource from './ResourcePackDetailResource.vue'
import ResourcePackItem from './ResourcePackItem.vue'
import { kSearchModel } from '@/composables/search'
import { sort } from '@/composables/sortBy'

const { runtime, path } = injection(kInstance)
const { files, enable, disable, insert } = injection(kInstanceResourcePacks)
const {
  keyword,
  curseforgeCategory,
  modrinthCategories,
  currentView,
  gameVersion,
} = injection(kSearchModel)
const {
  error,
  loading,
  loadMore,
  items: originalItems,
  effect,
  sortBy,
} = injection(kResourcePackSearch)

// Register the resource pack search effect
effect()

const isLocalFile = (f: any): f is ProjectEntry<InstanceResourcePack> => !!f

const items = computed(() => {
  const result: (string | ProjectEntry)[] = []

  if (currentView.value === 'local') {
    const {
      enabled,
      disabled,
      others,
    } = originalItems.value.reduce((arrays, item) => {
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
    }, {
      enabled: [] as ProjectEntry[],
      disabled: [] as ProjectEntry[],
      others: [] as ProjectEntry[],
    })
    if (enabled.length > 0) {
      result.push('enabled' as string)
      result.push(...enabled)
    }
    if (disabled.length > 0) {
      result.push('disabled' as string)
      sort(sortBy.value, disabled)
      result.push(...disabled)
    }
    if (others.length > 0) {
      result.push('search' as string)
      result.push(...others)
    }
  } else if (currentView.value === 'remote') {
    result.push('search' as string)
    result.push(...originalItems.value)
  } else {
    result.push(...originalItems.value)
  }
  return result
})

// Enable disable install uninstall
const onUninstall = (v: ProjectFile[]) => {
  const packs = v as InstanceResourcePack[]
  disable(packs)
  uninstall(path.value, packs.map(p => p.path))
}
const onEnable = (f: ProjectFile) => {
  enable([f as InstanceResourcePack])
  install(path.value, [f.path])
}
const onDisable = (f: ProjectFile) => {
  disable([f as InstanceResourcePack])
}
const onDrop = (item: ResourcePackProject, id: string) => {
  const _items = items.value
  if (_items[0] !== 'enabled') {
    return
  }
  const target = _items.indexOf(item)
  const from = _items.findIndex(e => typeof e === 'object' && e.id === id)
  if (target !== -1 && from !== -1) {
    insert(from, target)
  }
}

const onLoad = loadMore

const toggleCategory = useToggleCategories(modrinthCategories)

// Reset all filter
onUnmounted(() => {
  keyword.value = ''
  modrinthCategories.value = []
  curseforgeCategory.value = undefined
})

// Presence
const { t } = useI18n()
const { name } = injection(kInstance)
usePresence(computed(() => t('presence.resourcePack', { instance: name.value })))

// Page compact
const compact = injection(kCompact)
onMounted(() => {
  compact.value = true
})

const { installFromMarket, uninstall, install } = useService(InstanceResourcePacksServiceKey)

// Drop
const { dragover } = useGlobalDrop({
  onDrop: async (t) => {
    const paths = [] as string[]
    for (const f of t.files) {
      paths.push(f.path)
    }
    if (paths.length > 0) {
      const installed = await install(path.value, paths)
      await enable(installed)
    }
  },
})

// modrinth installer
const modrinthInstaller = useModrinthInstaller(
  path,
  runtime,
  files,
  installFromMarket,
  onUninstall,
)
provide(kModrinthInstaller, modrinthInstaller)

// curseforge installer
const curseforgeInstaller = useCurseforgeInstaller(
  path,
  runtime,
  files,
  installFromMarket,
  onUninstall,
)
provide(kCurseforgeInstaller, curseforgeInstaller)

const onInstallProject = useProjectInstall(
  runtime,
  ref(undefined),
  curseforgeInstaller,
  modrinthInstaller,
  (f) => {
    install(path.value, [f.path])
    enable([f.path])
  },
)

const getInstalledModrinth = (projectId: string) => {
  return files.value.filter((m) => m.modrinth?.projectId === projectId)
}
const getInstalledCurseforge = (modId: number | undefined) => {
  return files.value.filter((m) => m.curseforge?.projectId === modId)
}

// dense
const denseView = useLocalStorageCacheBool('resource-pack-dense-view', false)
const itemHeight = computed(() => denseView.value ? 48 : 76)
</script>

<style scoped>
.resource-pack-page {
  @apply flex flex-col h-full grid grid-cols-2 lg:(gap-8 px-8) px-4 gap-3 pb-4 relative overflow-x-hidden overflow-y-auto;
}

.list-title {
  @apply w-full sticky top-0 z-10 flex-shrink-0 pl-0;
  text-transform: uppercase;
  text-indent: 0.0892857143em;
  letter-spacing: .0892857143em;
}

.list {
  @apply h-full overflow-y-auto flex flex-col;
}

.transition-list {
  @apply overflow-auto flex flex-col gap-1.5 p-1;
}
</style>
