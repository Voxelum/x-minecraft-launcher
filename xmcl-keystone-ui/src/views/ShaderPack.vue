<template>
  <MarketBase
    :items="all"
    :item-height="80"
    :plans="{}"
    :error="modrinthError"
    :class="{
      dragover,
    }"
    :loading="loading"
    @load="loadMoreModrinth"
  >
    <template #item="{ item, hasUpdate, checked, selectionMode, selected, on }">
      <v-subheader
        v-if="typeof item === 'string'"
        class="h-[76px]"
      >
        {{ item === 'enabled' ? t("shaderPack.enabled") : t("shaderPack.disabled") }}
      </v-subheader>
      <ShaderPackItem
        v-else
        :pack="item"
        :selection-mode="selectionMode"
        :selected="selected"
        :has-update="hasUpdate"
        :checked="checked"
        :install="onInstallProject"
        @click="on.click"
      />
    </template>
    <template #content="{ selectedModrinthId, selectedItem }">
      <Hint
        v-if="dragover"
        icon="save_alt"
        :text="
          t('shaderPack.dropHint')"
        class="h-full"
      />
      <MarketProjectDetailModrinth
        v-if="selectedItem && (selectedItem.modrinth || selectedModrinthId)"
        :modrinth="selectedItem.modrinth"
        :project-id="selectedModrinthId"
        :installed="selectedItem.installed"
        :game-version="gameVersion"
        :loaders="shaderLoaderFilters"
        :categories="modrinthCategories"
        :all-files="shaderProjectFiles"
        :curseforge="selectedItem?.curseforge?.id || selectedItem.curseforgeProjectId"
        @install="onInstall"
        @uninstall="onUninstall"
        @enable="onEnable"
        @disable="onUninstall([$event])"
        @category="toggleCategory"
      />
      <ShaderPackDetailResource
        v-else-if="isShaderPackProject(selectedItem)"
        :shader-pack="selectedItem"
        :installed="selectedItem.files?.map(i => i.resource) || []"
        :runtime="runtime"
      />
      <MarketRecommendation
        v-else
        modrinth="shader"
        @modrinth="modrinthCategories.push($event.name)"
      />
    </template>
    <!-- <DeleteDialog
      :title="t('shaderPack.deletion') "
      :width="400"
      persistent
      @confirm="onConfirmDeleted"
      @cancel="onCancelDelete"
    >
      <div
        style="overflow: hidden; word-break: break-all;"
      >
        {{ t('shaderPack.deletionHint', { path: deletingPack ? deletingPack.path : '' }) }}
      </div>
    </DeleteDialog> -->
  </MarketBase>
</template>

<script lang="ts" setup>
import Hint from '@/components/Hint.vue'
import MarketBase from '@/components/MarketBase.vue'
import MarketProjectDetailModrinth from '@/components/MarketProjectDetailModrinth.vue'
import { kCurseforgeInstaller, useCurseforgeInstaller } from '@/composables/curseforgeInstaller'
import { useDrop } from '@/composables/dropHandler'
import { kInstance } from '@/composables/instance'
import { kInstanceShaderPacks } from '@/composables/instanceShaderPack'
import { kModrinthInstaller, useModrinthInstaller } from '@/composables/modrinthInstaller'
import { usePresence } from '@/composables/presence'
import { useProjectInstall } from '@/composables/projectInstall'
import { kCompact } from '@/composables/scrollTop'
import { useService } from '@/composables/service'
import { ShaderPackProject, kShaderPackSearch } from '@/composables/shaderPackSearch'
import { useToggleCategories } from '@/composables/toggleCategories'
import { injection } from '@/util/inject'
import { ProjectEntry, ProjectFile } from '@/util/search'
import { Resource, ResourceDomain, ResourceServiceKey } from '@xmcl/runtime-api'
import ShaderPackDetailResource from './ShaderPackDetailResource.vue'
import ShaderPackItem from './ShaderPackItem.vue'
import MarketRecommendation from '@/components/MarketRecommendation.vue'

const {
  modrinthError,
  loading,
  networkOnly,
  items,
  keyword,
  shaderProjectFiles,
  shaderLoaderFilters,
  modrinthCategories,
  loadMoreModrinth,
  gameVersion,
  effect,
} = injection(kShaderPackSearch)
const { runtime, path } = injection(kInstance)

effect()

const all = computed(() => {
  if (networkOnly.value) return items.value
  const rest = [] as ProjectEntry<ProjectFile>[]
  const enabled = [] as ProjectEntry<ProjectFile>[]
  for (const i of items.value) {
    if (!i.disabled) {
      enabled.push(i)
    } else {
      rest.push(i)
    }
  }
  if (enabled.length > 0) {
    return [
      'enabled' as string,
      ...enabled,
      'disabled' as string,
      ...rest,
    ] as (string | ProjectEntry<ProjectFile>)[]
  }
  return [
    'disabled' as string,
    ...rest,
  ]
})

const toggleCategory = useToggleCategories(modrinthCategories)

const { t } = useI18n()

const isShaderPackProject = (p: ProjectEntry<ProjectFile> | undefined): p is ShaderPackProject => !!p

const { shaderPack } = injection(kInstanceShaderPacks)
const { removeResources } = useService(ResourceServiceKey)

const onInstall = (r: Resource[]) => {
  shaderPack.value = r[0].fileName
}
const onUninstall = (files: ProjectFile[]) => {
  shaderPack.value = ''
  removeResources(files.map(f => f.resource.hash))
}
const onEnable = (f: ProjectFile) => {
  shaderPack.value = f.resource.fileName
}

// Reset all filter
onUnmounted(() => {
  keyword.value = ''
  modrinthCategories.value = []
})

// Presence
const { name } = injection(kInstance)
usePresence(computed(() => t('presence.shaderPack', { instance: name.value })))

// Drop
const { importResources } = useService(ResourceServiceKey)
const { dragover } = useDrop(() => {}, async (t) => {
  const paths = [] as string[]
  for (const f of t.files) {
    paths.push(f.path)
  }
  const resources = await importResources(paths.map(p => ({ path: p, domain: ResourceDomain.ShaderPacks })))
  shaderPack.value = resources[0].fileName
}, () => {})

// Page compact
const compact = injection(kCompact)
onMounted(() => {
  compact.value = true
})

// modrinth installer
const modrinthInstaller = useModrinthInstaller(
  path,
  runtime,
  shaderProjectFiles,
  onInstall,
  onUninstall,
)
provide(kModrinthInstaller, modrinthInstaller)

// curseforge installer
const curseforgeInstaller = useCurseforgeInstaller(
  path,
  runtime,
  shaderProjectFiles,
  onInstall,
  onUninstall,
  'mc-mods',
)
provide(kCurseforgeInstaller, curseforgeInstaller)

const onInstallProject = useProjectInstall(
  runtime,
  shaderLoaderFilters,
  curseforgeInstaller,
  modrinthInstaller,
)

</script>
