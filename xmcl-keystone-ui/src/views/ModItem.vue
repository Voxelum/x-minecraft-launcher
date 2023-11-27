<template>
  <MarketItem
    :item="item"
    :selection-mode="selectionMode"
    :selected="selected"
    :has-update="hasUpdate"
    :checked="checked"
    :height="91"
    :get-context-menu-items="getContextMenuItems"
    :install="install"
    @click="emit('click', $event)"
    @checked="emit('checked', $event)"
  >
    <template
      v-if="item.installed && (item.installed?.[0]?.tags.length + compatibility.length) > 0"
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

const props = defineProps<{
  item: ProjectEntry<ModFile>
  selectionMode: boolean
  checked: boolean
  selected: boolean
  hasUpdate?: boolean
  install: (p: ProjectEntry) => Promise<void>
}>()

const emit = defineEmits(['click', 'checked', 'install'])

const { provideRuntime } = injection(kInstanceModsContext)
const { t } = useI18n()
const tooltip = computed(() => props.hasUpdate ? t('mod.hasUpdate') : props.item.description || props.item.title)
const { isCompatible, compatibility } = useModCompatibility(computed(() => props.item.installed[0]?.dependencies || []), provideRuntime)
const { uninstall, disable, enable } = useService(InstanceModsServiceKey)
const { path } = injection(kInstance)
const getContextMenuItems = useModItemContextMenuItems(computed(() => props.item.installed?.[0] || props.item.files?.[0]), () => {
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

</script>
