<template>
  <MarketBase
    :items="items"
    :item-height="80"
    :plans="{}"
    :error="modrinthError"
    :class="{
      dragover,
    }"
    :loading="loading"
  >
    <template #item="{ item, hasUpdate, checked, selectionMode, selected, on }">
      <ShaderPackItem
        :pack="item"
        :selection-mode="selectionMode"
        :selected="selected"
        :has-update="hasUpdate"
        :checked="checked"
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
        :loaders="shaderLoaderFilters"
        :categories="modrinthCategories"
        :runtime="runtime"
        :all-files="shaderProjectFiles"
        :curseforge="selectedItem?.curseforge?.id || selectedItem.curseforgeProjectId"
        @install="onInstall"
        @uninstall="onUninstall"
        @enable="onEnable"
        @disable="onUninstall"
        @category="toggleCategory"
      />
      <ShaderPackDetailResource
        v-else-if="isShaderPackProject(selectedItem)"
        :shader-pack="selectedItem"
        :installed="selectedItem.files?.map(i => i.resource) || []"
        :runtime="runtime"
      />
      <Hint
        v-else
        icon="playlist_add"
        :text="
          t('shaderPack.selectSearchHint')"
        class="h-full"
      />
    </template>
  </MarketBase>
  <!--
      <DeleteDialog
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
      </DeleteDialog>
    </div>
  </div> -->
</template>

<script lang="ts" setup>
import Hint from '@/components/Hint.vue'
import MarketBase from '@/components/MarketBase.vue'
import MarketProjectDetailModrinth from '@/components/MarketProjectDetailModrinth.vue'
import { useDrop } from '@/composables/dropHandler'
import { kInstance } from '@/composables/instance'
import { kInstanceShaderPacks } from '@/composables/instanceShaderPack'
import { usePresence } from '@/composables/presence'
import { useService } from '@/composables/service'
import { ShaderPackProject, kShaderPackSearch } from '@/composables/shaderPackSearch'
import { useToggleCategories } from '@/composables/toggleCategories'
import { vDragover } from '@/directives/dragover'
import { injection } from '@/util/inject'
import { ProjectEntry, ProjectFile } from '@/util/search'
import { Resource, ResourceDomain, ResourceServiceKey } from '@xmcl/runtime-api'
import ShaderPackDetailResource from './ShaderPackDetailResource.vue'
import ShaderPackItem from './ShaderPackItem.vue'

const {
  modrinthError,
  loading,
  items,
  keyword,
  shaderProjectFiles,
  shaderLoaderFilters,
  modrinthCategories,
} = injection(kShaderPackSearch)
const { runtime } = injection(kInstance)

const toggleCategory = useToggleCategories(modrinthCategories)

const { t } = useI18n()

const isShaderPackProject = (p: ProjectEntry<ProjectFile> | undefined): p is ShaderPackProject => !!p

const { shaderPack } = injection(kInstanceShaderPacks)

const onInstall = (r: Resource[]) => {
  shaderPack.value = r[0].fileName
}
const onUninstall = () => {
  shaderPack.value = ''
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
</script>
