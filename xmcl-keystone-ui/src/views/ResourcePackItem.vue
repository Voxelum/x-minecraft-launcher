<template>
  <MarketItem
    :item="pack"
    :selection-mode="selectionMode"
    :selected="selected"
    :has-update="hasUpdate"
    :checked="checked"
    :draggable="draggable"
    :dense="dense"
    :height="itemHeight"
    :get-context-menu-items="isBuiltIn ? undefined : getContextMenuItems"
    :install="install"
    @drop="emit('drop', $event)"
    @click="emit('click', $event)"
    @checked="emit('check', $event)"
  >
    <template
      v-if="pack.installed.length > 0"
      #labels
    >
      <v-chip
        v-shared-tooltip="tooltip"
        label
        outlined
        small
      >
        <v-avatar left>
          <v-img
            :src="BuiltinImages.minecraft"
            left
          />
        </v-avatar>
        {{ pack.installed[0].acceptingRange }}
        <v-avatar right>
          {{ icon }}
        </v-avatar>
      </v-chip>
      <v-icon
        v-if="pack.modrinth || pack.curseforge || pack.modrinthProjectId || pack.curseforgeProjectId"
        class="mt-1"
        small
      >
        {{ (pack.modrinth || pack.modrinthProjectId) ? '$vuetify.icons.modrinth' : (pack.curseforge || pack.curseforgeProjectId) ? '$vuetify.icons.curseforge' : '' }}
      </v-icon>
    </template>
  </MarketItem>
</template>
<script setup lang="ts">
import MarketItem from '@/components/MarketItem.vue'
import { useService } from '@/composables'
import { ContextMenuItem } from '@/composables/contextMenu'
import { kInstance } from '@/composables/instance'
import { ResourcePackProject } from '@/composables/resourcePackSearch'
import { vSharedTooltip } from '@/directives/sharedTooltip'
import { injection } from '@/util/inject'
import { ProjectEntry } from '@/util/search'
import { BaseServiceKey, ResourceServiceKey, isCompatible } from '@xmcl/runtime-api'
import { BuiltinImages } from '../constant'

const props = defineProps<{
  pack: ResourcePackProject
  selectionMode: boolean
  checked: boolean
  draggable?: boolean
  selected: boolean
  hasUpdate?: boolean
  dense?: boolean
  itemHeight?: number
  install: (p: ProjectEntry) => Promise<void>
}>()

const emit = defineEmits<{
  (event: 'click', pack: ResourcePackProject): void
  (event: 'check', pack: ResourcePackProject): void
  (event: 'drop', id: string): void
  (event: 'install'): void
}>()

const { runtime } = injection(kInstance)
const compatible = computed(() => {
  return isCompatible(props.pack.installed[0].acceptingRange, runtime.value.minecraft)
})
const icon = computed(() => {
  return compatible.value ? '✔️' : '❌'
})

const tooltip = computed(() => compatible.value
  ? t('resourcepack.compatible', {
    format: props.pack.installed[0].pack_format,
    version: runtime.value.minecraft,
  })
  : t('resourcepack.incompatible', {
    accept: props.pack.installed[0].acceptingRange,
    actual: runtime.value.minecraft,
    format: props.pack.installed[0].pack_format,
  }))

const { t } = useI18n()
const { removeResources } = useService(ResourceServiceKey)
const { showItemInDirectory } = useService(BaseServiceKey)

const isBuiltIn = computed(() => props.pack.id === 'vanilla' || props.pack.id === 'fabric' || props.pack.id === 'file/mod_resources')
const getContextMenuItems = () => {
  const all = [] as ContextMenuItem[]
  if (props.pack.installed.length > 0) {
    all.push({
      text: t('resourcepack.showFile', { file: props.pack.installed[0].resource.path }),
      onClick: () => {
        showItemInDirectory(props.pack.installed[0].resource.path)
      },
      icon: 'folder',
    })
    all.push({
      text: t('delete.name', { name: props.pack.title }),
      onClick: () => {
        const filter = props.pack.installed.map(f => f.resource?.hash).filter((v): v is string => !!v)
        removeResources(filter)
      },
      icon: 'delete',
      color: 'error',
    })
  }

  // if (props.pack.curseforgeProjectId || props.pack.curseforge) {
  //   all.push({
  //     text: t('resourcepack.showInCurseforge', { name: props.pack.title }),
  //     onClick: () => {
  //       goCurseforgeProject(props.pack.curseforgeProjectId || props.pack.curseforge?.id || 0, 'texture-packs')
  //     },
  //     icon: '$vuetify.icons.curseforge',
  //   })
  // } else {
  //   all.push({
  //     text: t('resourcepack.searchOnCurseforge', { name: props.pack.title }),
  //     onClick: () => {
  //       searchInCurseforge(props.pack.title, 'texture-packs')
  //     },
  //     icon: 'search',
  //   })
  // }

  // if (props.pack.modrinthProjectId || props.pack.modrinth) {
  //   all.push({
  //     text: t('mod.showInModrinth', { name: props.pack.title }),
  //     onClick: () => {
  //       goModrinthProject(props.pack.modrinthProjectId || props.pack.modrinth?.project_id || '')
  //     },
  //     icon: '$vuetify.icons.modrinth',
  //   })
  // } else {
  //   all.push({
  //     text: t('resourcepack.searchOnModrinth', { name: props.pack.title }),
  //     onClick: () => {
  //       searchInModrinth(props.pack.title, 'resourcepack')
  //     },
  //     icon: 'search',
  //   })
  // }
  return all
}

</script>
