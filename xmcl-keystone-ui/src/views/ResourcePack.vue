<template>
  <MarketBase
    :items="displayItems"
    :item-height="76"
    :plans="{}"
    :class="{
      dragover,
    }"
    :error="modrinthError"
    :loading="loading"
  >
    <template #item="{ item, hasUpdate, checked, selectionMode, selected, on }">
      <v-subheader
        v-if="typeof item === 'string'"
        class="h-[76px]"
      >
        {{ item === 'enabled' ? t("resourcepack.selected") : t("resourcepack.unselected") }}
      </v-subheader>
      <ResourcePackItem
        v-else-if="(typeof item === 'object')"
        :pack="item"
        :draggable="allMode && !item.disabled"
        :selection-mode="selectionMode"
        :selected="selected"
        :has-update="hasUpdate"
        :checked="checked"
        @drop="onDrop(item, $event)"
        @click="on.click"
      />
    </template>
    <template #content="{ selectedModrinthId, selectedItem, selectedCurseforgeId }">
      <Hint
        v-if="dragover"
        icon="save_alt"
        :text="
          t('resourcepack.dropHint')"
        class="h-full"
      />
      <MarketProjectDetailModrinth
        v-else-if="selectedItem && (selectedItem.modrinth || selectedModrinthId)"
        :modrinth="selectedItem.modrinth"
        :project-id="selectedModrinthId"
        :installed="selectedItem.installed"
        :loaders="modrinthLoaders"
        :categories="modrinthCategories"
        :runtime="runtime"
        :all-files="files"
        @install="onInstall"
        @uninstall="onUninstall"
        @enable="onEnable"
        @disable="onDisable"
        @category="toggleCategory"
      />
      <MarketProjectDetailCurseforge
        v-else-if="selectedItem && selectedCurseforgeId"
        :curseforge="selectedItem.curseforge"
        :curseforge-id="selectedItem.curseforge?.id || selectedCurseforgeId"
        :installed="selectedItem.installed"
        :loaders="[]"
        :category="curseforgeCategory"
        :runtime="runtime"
        :all-files="files"
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
      <Hint
        v-else
        icon="playlist_add"
        :text="
          t('resourcepack.selectSearchHint')"
        class="h-full"
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
import { useDrop } from '@/composables/dropHandler'
import { kInstance } from '@/composables/instance'
import { InstanceResourcePack, kInstanceResourcePacks } from '@/composables/instanceResourcePack'
import { usePresence } from '@/composables/presence'
import { ResourcePackProject, kResourcePackSearch } from '@/composables/resourcePackSearch'
import { kCompact } from '@/composables/scrollTop'
import { useToggleCategories } from '@/composables/toggleCategories'
import { vDragover } from '@/directives/dragover'
import { injection } from '@/util/inject'
import { ProjectEntry, ProjectFile } from '@/util/search'
import { Resource, ResourceDomain, ResourceServiceKey } from '@xmcl/runtime-api'
import ResourcePackDetailResource from './ResourcePackDetailResource.vue'
import ResourcePackItem from './ResourcePackItem.vue'

const { runtime } = injection(kInstance)
const { files, enable, disable, insert } = injection(kInstanceResourcePacks)
const {
  items,
  modrinthError,
  loading,
  modrinthCategories,
  curseforgeCategory,
  enabled,
  disabled,
  keyword,
} = injection(kResourcePackSearch)

const isLocalFile = (f: any): f is ProjectEntry<InstanceResourcePack> => !!f

const allMode = computed(() => !keyword.value && modrinthCategories.value.length === 0 && !curseforgeCategory.value)

const displayItems = computed(() => {
  if (allMode.value) {
    return [
      'enabled' as string,
      ...enabled.value,
      'disabled' as string,
      ...disabled.value,
    ] as (string | ResourcePackProject)[]
  }
  return items.value
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
  removeResources(v.map(f => f.resource.hash))
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
const { dragover } = useDrop(() => {}, async (t) => {
  const paths = [] as string[]
  for (const f of t.files) {
    paths.push(f.path)
  }
  const resources = await importResources(paths.map(p => ({ path: p, domain: ResourceDomain.ResourcePacks })))
  enable(resources.map(r => `file/${r.fileName}`))
}, () => {})

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
