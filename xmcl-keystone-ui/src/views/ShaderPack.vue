<template>
  <MarketBase
    :items="all"
    :item-height="itemHeight"
    :plans="{}"
    :error="modrinthError"
    :class="{
      dragover,
    }"
    :loading="loading"
    @load="loadMoreModrinth"
  >
    <template #item="{ item, hasUpdate, checked, selectionMode, selected, on, index }">
      <v-subheader
        v-if="typeof item === 'string'"
        :style="{ height: itemHeight + 'px' }"
        class="flex"
      >
        {{ item === 'enabled' ? t("shaderPack.enabled") : item === 'disabled' ? t("shaderPack.disabled") : t('modInstall.search') }}

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
      <ShaderPackItem
        v-else
        :pack="item"
        :selection-mode="selectionMode"
        :selected="selected"
        :dense="denseView"
        :item-height="itemHeight"
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
import MarketRecommendation from '@/components/MarketRecommendation.vue'
import { useLocalStorageCacheBool } from '@/composables/cache'
import { kCurseforgeInstaller, useCurseforgeInstaller } from '@/composables/curseforgeInstaller'
import { useDrop } from '@/composables/dropHandler'
import { kInstance } from '@/composables/instance'
import { InstanceShaderFile, kInstanceShaderPacks } from '@/composables/instanceShaderPack'
import { kModrinthInstaller, useModrinthInstaller } from '@/composables/modrinthInstaller'
import { usePresence } from '@/composables/presence'
import { useProjectInstall } from '@/composables/projectInstall'
import { kCompact } from '@/composables/scrollTop'
import { useService } from '@/composables/service'
import { ShaderPackProject, kShaderPackSearch } from '@/composables/shaderPackSearch'
import { useToggleCategories } from '@/composables/toggleCategories'
import { vSharedTooltip } from '@/directives/sharedTooltip'
import { injection } from '@/util/inject'
import { ProjectEntry, ProjectFile } from '@/util/search'
import { Resource, ResourceDomain, ResourceServiceKey } from '@xmcl/runtime-api'
import ShaderPackDetailResource from './ShaderPackDetailResource.vue'
import ShaderPackItem from './ShaderPackItem.vue'

const {
  modrinthError,
  loading,

  enabled,
  disabled,
  others,

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
  removeResources(files.map(f => (f as InstanceShaderFile).resource.hash))
}
const onEnable = (f: ProjectFile) => {
  shaderPack.value = (f as InstanceShaderFile).resource.fileName
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

// dense
const denseView = useLocalStorageCacheBool('shader-pack-dense-view', false)
const itemHeight = computed(() => denseView.value ? 48 : 80)

</script>
