<template>
  <MarketItem
    :item="item"
    :selection-mode="selectionMode"
    :selected="selected"
    :has-update="hasUpdate"
    :checked="checked"
    :height="itemHeight"
    :get-context-menu-items="getContextMenuItems"
    :install="install"
    :dense="dense"
    @click="emit('click', $event)"
    @checked="emit('checked', $event)"
  >
    <template
      v-if="!dense && item.installed && (item.installed?.[0]?.tags.length + compatibility.length) > 0"
      #labels
    >
      <ModLabels
        :disabled="item.disabled"
        :compatibility="compatibility"
        :tags="item.installed[0].tags"
      />
    </template>
  </MarketItem>
</template>

<script lang="ts" setup>
import MarketItem from '@/components/MarketItem.vue'
import { useService } from '@/composables'
import { kInstance } from '@/composables/instance'
import { kInstanceModsContext } from '@/composables/instanceMods'
import { useModCompatibility } from '@/composables/modCompatibility'
import { useModItemContextMenuItems } from '@/composables/modContextMenu'
import { injection } from '@/util/inject'
import { ModFile } from '@/util/mod'
import { ProjectEntry } from '@/util/search'
import { InstanceModsServiceKey } from '@xmcl/runtime-api'
import ModLabels from './ModLabels.vue'
import { ContextMenuItem } from '@/composables/contextMenu'

const props = defineProps<{
  item: ProjectEntry<ModFile>
  selectionMode: boolean
  checked: boolean
  selected: boolean
  itemHeight: number
  hasUpdate?: boolean
  dense?: boolean
  getContextMenuItems?: () => ContextMenuItem[]
  install: (p: ProjectEntry) => Promise<void>
}>()

const emit = defineEmits(['click', 'checked', 'install'])

const { provideRuntime } = injection(kInstanceModsContext)
const { compatibility } = useModCompatibility(computed(() => props.item.installed[0]?.dependencies || []), provideRuntime)
const { uninstall, disable, enable } = useService(InstanceModsServiceKey)
const { path } = injection(kInstance)
const _getContextMenuItems = useModItemContextMenuItems(computed(() => props.item), () => {
  if (props.item.installed) {
    uninstall({ path: path.value, mods: props.item.installed.map(i => i.resource) })
  }
}, () => {}, () => {
  if (props.item.installed.length > 0) {
    if (props.item.installed[0].enabled) {
      disable({ path: path.value, mods: props.item.installed.map(i => i.resource) })
    } else {
      enable({ path: path.value, mods: props.item.installed.map(i => i.resource) })
    }
  }
})
const getContextMenuItems = () => {
  const items = props.getContextMenuItems?.()
  if (items && items.length > 0) return items
  return _getContextMenuItems()
}
</script>
