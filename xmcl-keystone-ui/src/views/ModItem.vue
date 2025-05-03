<template>
  <MarketItem
    :indent="indent"
    :indent-color="indentColor"
    :item="item"
    :selection-mode="selectionMode"
    :selected="selected"
    :has-update="hasUpdate"
    :checked="checked"
    :height="itemHeight"
    no-duplicate
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
  indent?: boolean
  indentColor?: string
  getContextMenuItems?: (item: ProjectEntry<ModFile>) => ContextMenuItem[]
  install: (p: ProjectEntry) => Promise<void>
}>()

const emit = defineEmits(['click', 'checked', 'install'])

const { compatibility: compatibilities } = injection(kInstanceModsContext)
const compatibility = computed(() => props.item.installed[0] ? compatibilities.value[props.item.installed[0].modId] ?? [] : [])
const { uninstall, disable, enable } = useService(InstanceModsServiceKey)
const { path } = injection(kInstance)
const _getContextMenuItems = useModItemContextMenuItems(computed(() => props.item), () => {
  if (props.item.installed) {
    uninstall({ path: path.value, mods: props.item.installed.map(i => i.path) })
  }
}, () => { }, () => {
  if (props.item.installed && props.item.installed.length > 0) {
    if (props.item.installed[0].enabled) {
      disable({ path: path.value, mods: props.item.installed.map(i => i.path) })
    } else {
      enable({ path: path.value, mods: props.item.installed.map(i => i.path) })
    }
  }
})

const selections = inject('selections', {} as Ref<Record<string, boolean>>)
const getContextMenuItems = () => {
  const items = props.getContextMenuItems?.(props.item)
  if (Object.keys(selections.value).length > 1) return items || []
  return _getContextMenuItems().concat(items ?? [])
}

const hasLabel = computed(() => !props.dense && props.item.installed && (props.item.installed?.[0]?.tags.length + compatibility.value.length) > 0)
</script>
