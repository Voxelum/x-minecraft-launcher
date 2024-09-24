<template>
  <MarketItem
    :item="pack"
    :selection-mode="selectionMode"
    :selected="selected"
    :has-update="hasUpdate"
    :checked="checked"
    :dense="dense"
    :height="itemHeight"
    :get-context-menu-items="getContextMenuItems"
    :install="install"
    @click="emit('click', $event)"
    @checked="emit('check', $event)"
  />
</template>
<script setup lang="ts">
import MarketItem from '@/components/MarketItem.vue'
import { useService } from '@/composables'
import { ContextMenuItem } from '@/composables/contextMenu'
import { kInstance } from '@/composables/instance'
import { ShaderPackProject } from '@/composables/shaderPackSearch'
import { injection } from '@/util/inject'
import { ProjectEntry } from '@/util/search'
import { BaseServiceKey, InstanceShaderPacksServiceKey } from '@xmcl/runtime-api'

const props = defineProps<{
  pack: ShaderPackProject
  selectionMode: boolean
  checked: boolean
  selected: boolean
  hasUpdate?: boolean
  dense?: boolean
  itemHeight?: number
  install: (p: ProjectEntry) => Promise<void>
}>()

const emit = defineEmits<{
  (event: 'click', pack: ShaderPackProject): void
  (event: 'check', pack: ShaderPackProject): void
  (event: 'install', pack: ShaderPackProject): void
}>()

const { t } = useI18n()
const { showItemInDirectory } = useService(BaseServiceKey)
const { uninstall } = useService(InstanceShaderPacksServiceKey)
const { path } = injection(kInstance)
const getContextMenuItems = () => {
  const all = [] as ContextMenuItem[]
  // const id = props.pack.modrinth?.project_id || props.pack.modrinthProjectId
  if (props.pack.installed.length > 0) {
    all.push({
      text: t('delete.name', { name: props.pack.title }),
      onClick: () => {
        uninstall(path.value, props.pack.installed.map(f => f.path))
      },
      icon: 'delete',
      color: 'error',
    }, {
      text: t('shaderPack.showFile', { file: props.pack.installed[0].path }),
      onClick: () => {
        showItemInDirectory(props.pack.installed[0].path)
      },
      icon: 'folder',
    })
  }
  // if (id) {
  //   all.push({
  //     text: t('mod.showInModrinth'),
  //     onClick: () => {
  //       goModrinthProject(id)
  //     },
  //     icon: '$vuetify.icons.modrinth',
  //   })
  // }
  return all
}

</script>
