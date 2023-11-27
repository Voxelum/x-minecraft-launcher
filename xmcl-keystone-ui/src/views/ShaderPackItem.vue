<template>
  <MarketItem
    :item="pack"
    :selection-mode="selectionMode"
    :selected="selected"
    :has-update="hasUpdate"
    :checked="checked"
    :height="80"
    :get-context-menu-items="getContextMenuItems"
    :install="install"
    @click="emit('click', $event)"
    @checked="emit('check', $event)"
  />
</template>
<script setup lang="ts">
import { ShaderPackProject } from '@/composables/shaderPackSearch'
import MarketItem from '@/components/MarketItem.vue'
import { ContextMenuItem } from '@/composables/contextMenu'
import { useMarketRoute } from '@/composables/useMarketRoute'
import { BaseServiceKey, ResourceServiceKey } from '@xmcl/runtime-api'
import { useService } from '@/composables'

const props = defineProps<{
  pack: ShaderPackProject
  selectionMode: boolean
  checked: boolean
  selected: boolean
  hasUpdate?: boolean
  install: (p: ShaderPackProject) => Promise<void>
}>()

const emit = defineEmits<{
  (event: 'click', pack: ShaderPackProject): void
  (event: 'check', pack: ShaderPackProject): void
  (event: 'install', pack: ShaderPackProject): void
}>()

const { goModrinthProject } = useMarketRoute()
const { t } = useI18n()
const { removeResources } = useService(ResourceServiceKey)
const { showItemInDirectory } = useService(BaseServiceKey)
const getContextMenuItems = () => {
  const all = [] as ContextMenuItem[]
  const id = props.pack.modrinth?.project_id || props.pack.modrinthProjectId
  if (props.pack.installed.length > 0) {
    all.push({
      text: t('delete.name', { name: props.pack.title }),
      onClick: () => {
        removeResources(props.pack.installed.map(f => f.resource.hash))
      },
      icon: 'delete',
      color: 'error',
    }, {
      text: t('shaderPack.showFile', { file: props.pack.installed[0].resource.path }),
      onClick: () => {
        showItemInDirectory(props.pack.installed[0].resource.path)
      },
      icon: 'folder',
    })
  }
  if (id) {
    all.push({
      text: t('mod.showInModrinth'),
      onClick: () => {
        goModrinthProject(id)
      },
      icon: '$vuetify.icons.modrinth',
    })
  }
  return all
}

</script>
