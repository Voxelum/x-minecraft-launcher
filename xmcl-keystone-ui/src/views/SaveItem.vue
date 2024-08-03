<template>
  <MarketItem
    :item="item"
    :selection-mode="selectionMode"
    :selected="selected"
    :has-update="hasUpdate"
    :checked="checked"
    :height="itemHeight"
    :get-context-menu-items="getContextMenuItems"
    :dense="dense"
    @click="emit('click', $event)"
    @checked="emit('checked', $event)"
  >
    <template
      v-if="!dense && installedOne"
      #labels
    >
      <AvatarChip
        small
        :avatar="BuiltinImages.minecraft"
        :text="installedOne.gameVersion"
      />
    </template>
  </MarketItem>
</template>

<script lang="ts" setup>
import AvatarChip from '@/components/AvatarChip.vue'
import MarketItem from '@/components/MarketItem.vue'
import { ContextMenuItem } from '@/composables/contextMenu'
import { kInstance } from '@/composables/instance'
import { InstanceSaveFile } from '@/composables/instanceSave'
import { useService } from '@/composables/service'
import { BuiltinImages } from '@/constant'
import { injection } from '@/util/inject'
import { ProjectEntry } from '@/util/search'
import { BaseServiceKey, InstanceSavesServiceKey } from '@xmcl/runtime-api'

const props = defineProps<{
  item: ProjectEntry<InstanceSaveFile>
  selectionMode: boolean
  checked: boolean
  selected: boolean
  itemHeight: number
  hasUpdate?: boolean
  dense?: boolean
}>()

const installedOne = computed(() => props.item.installed[0])

const emit = defineEmits(['click', 'checked', 'install', 'delete'])

const { t } = useI18n()
const { showItemInDirectory } = useService(BaseServiceKey)
const { exportSave } = useService(InstanceSavesServiceKey)
const { showSaveDialog } = windowController
const { path } = injection(kInstance)
async function doExport(name: string) {
  const { filePath } = await showSaveDialog({
    title: t('save.exportTitle'),
    message: t('save.exportMessage'),
    filters: [{ extensions: ['zip'], name: 'zip' }],
    defaultPath: `${name}.zip`,
  })
  if (filePath) {
    exportSave({ destination: filePath, zip: true, saveName: name, instancePath: path.value })
  }
}
const _getContextMenuItems = () => {
  const items: ContextMenuItem[] = []
  const file = props.item.files?.[0]
  if (file) {
    items.push({
      text: t('delete.name', { name: file.path }),
      icon: 'delete',
      onClick: () => emit('delete', file),
      color: 'red',
    }, {
      text: t('mod.showFile', { file: file.path }),
      onClick: () => {
        showItemInDirectory(file.path)
      },
      icon: 'folder',
    }, {
      text: t('save.export'),
      onClick: () => doExport(file.path),
      icon: 'map',
    })
  }
  return items
}
const getContextMenuItems = () => {
  return _getContextMenuItems()
}
</script>
