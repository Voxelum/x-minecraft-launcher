<template>
  <MarketBase
    :items="items"
    :item-height="80"
    :plans="{}"
    :error="modrinthError"
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
        v-dragover
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
import MarketBase from '@/components/MarketBase.vue'
import MarketProjectDetailModrinth from '@/components/MarketProjectDetailModrinth.vue'
import { kInstance } from '@/composables/instance'
import { usePresence } from '@/composables/presence'
import { ShaderPackProject, kShaderPackSearch } from '@/composables/shaderPackSearch'
import { injection } from '@/util/inject'
import ShaderPackDetailResource from './ShaderPackDetailResource.vue'
import ShaderPackItem from './ShaderPackItem.vue'
import { kInstanceShaderPacks } from '@/composables/instanceShaderPack'
import { Resource } from '@xmcl/runtime-api'
import { ProjectEntry, ProjectFile } from '@/util/search'
import { useToggleCategories } from '@/composables/toggleCategories'
import Hint from '@/components/Hint.vue'

const {
  modrinthError,
  loading,
  items,
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

const { name } = injection(kInstance)
usePresence(computed(() => t('presence.shaderPack', { instance: name.value })))
</script>
