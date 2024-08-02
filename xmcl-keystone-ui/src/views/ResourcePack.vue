<template>
  <MarketBase
    :items="displayItems"
    :item-height="itemHeight"
    :plans="{}"
    :class="{
      dragover,
    }"
    :error="modrinthError"
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
        :draggable="!networkOnly && !item.disabled"
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
        :loaders="modrinthLoaders"
        :categories="modrinthCategories"
        :all-files="files"
        :curseforge="selectedItem?.curseforge?.id || selectedCurseforgeId"
        @install="onInstall"
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
        :loaders="[]"
        :game-version="gameVersion"
        :category="curseforgeCategory"
        :all-files="files"
        :modrinth="selectedItem?.modrinth?.project_id || selectedModrinthId"
        @install="onInstall"
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
import { useService } from '@/composables'
import { kCurseforgeInstaller, useCurseforgeInstaller } from '@/composables/curseforgeInstaller'
import { useDrop } from '@/composables/dropHandler'
import { kInstance } from '@/composables/instance'
import { InstanceResourcePack, kInstanceResourcePacks } from '@/composables/instanceResourcePack'
import { kModrinthInstaller, useModrinthInstaller } from '@/composables/modrinthInstaller'
import { usePresence } from '@/composables/presence'
import { useProjectInstall } from '@/composables/projectInstall'
import { ResourcePackProject, kResourcePackSearch } from '@/composables/resourcePackSearch'
import { kCompact } from '@/composables/scrollTop'
import { useToggleCategories } from '@/composables/toggleCategories'
import { injection } from '@/util/inject'
import { ProjectEntry, ProjectFile } from '@/util/search'
import { Resource, ResourceDomain, ResourceServiceKey } from '@xmcl/runtime-api'
import ResourcePackDetailResource from './ResourcePackDetailResource.vue'
import ResourcePackItem from './ResourcePackItem.vue'
import SimpleDialog from '@/components/SimpleDialog.vue'
import MarketRecommendation from '@/components/MarketRecommendation.vue'
import { useLocalStorageCacheBool } from '@/composables/cache'
import { vSharedTooltip } from '@/directives/sharedTooltip'

const { runtime, path } = injection(kInstance)
const { files, enable, disable, insert } = injection(kInstanceResourcePacks)
const {
  modrinthError,
  loading,
  modrinthCategories,
  curseforgeCategory,

  enabled,
  disabled,
  others,

  loadMoreCurseforge,
  loadMoreModrinth,
  keyword,
  networkOnly,
  gameVersion,
  effect,
} = injection(kResourcePackSearch)

// Register the resource pack search effect
effect()

const isLocalFile = (f: any): f is ProjectEntry<InstanceResourcePack> => !!f

const displayItems = computed(() => {
  const result: (string | ProjectEntry)[] = []

  if (enabled.value.length > 0) {
    result.push(
      'enabled' as string,
      ...enabled.value,
    )
  }
  if (disabled.value.length > 0) {
    result.push(
      'disabled' as string,
      ...disabled.value,
    )
  }

  if (others.value.length > 0) {
    result.push(
      'search' as string,
      ...others.value,
    )
  }

  return result
})

const modrinthLoaders = computed(() => {
  const result = [
    'minecraft',
    'datapack',
  ] as string[]
  if (runtime.value.forge || runtime.value.neoForged) {
    result.push('forge', 'neoforged')
  }
  if (runtime.value.fabric) {
    result.push('fabric')
  }
  if (runtime.value.quiltLoader) {
    result.push('quilt')
  }
  return result
})

// Enable disable install uninstall
const { removeResources } = useService(ResourceServiceKey)
const onInstall = (r: Resource[]) => {
  enable(r.map(r => `file/${r.fileName}`))
}
const onUninstall = (v: ProjectFile[]) => {
  const packs = v as InstanceResourcePack[]
  removeResources(v.map(f => (f as InstanceResourcePack).resource.hash))
  disable(packs)
}
const onEnable = (f: ProjectFile) => {
  enable([f as InstanceResourcePack])
}
const onDisable = (f: ProjectFile) => {
  disable([f as InstanceResourcePack])
}
const onDrop = (item: ResourcePackProject, id: string) => {
  const target = enabled.value.indexOf(item)
  const from = enabled.value.findIndex(e => e.id === id)
  if (target !== -1 && from !== -1) {
    insert(from, target)
  }
}

const onLoad = () => {
  loadMoreCurseforge()
  loadMoreModrinth()
}

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

// Drop
const { importResources } = useService(ResourceServiceKey)
const { dragover } = useDrop(() => { }, async (t) => {
  const paths = [] as string[]
  for (const f of t.files) {
    paths.push(f.path)
  }
  const resources = await importResources(paths.map(p => ({ path: p, domain: ResourceDomain.ResourcePacks })))
  enable(resources.map(r => `file/${r.fileName}`))
}, () => { })

// modrinth installer
const modrinthInstaller = useModrinthInstaller(
  path,
  runtime,
  files,
  onInstall,
  onUninstall,
)
provide(kModrinthInstaller, modrinthInstaller)

// curseforge installer
const curseforgeInstaller = useCurseforgeInstaller(
  path,
  runtime,
  files,
  onInstall,
  onUninstall,
  'texture-packs',
)
provide(kCurseforgeInstaller, curseforgeInstaller)

const onInstallProject = useProjectInstall(
  runtime,
  modrinthLoaders,
  curseforgeInstaller,
  modrinthInstaller,
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
