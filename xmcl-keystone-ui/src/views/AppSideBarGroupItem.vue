<template>
  <v-sheet
    class="relative rounded-xl hover:rounded-lg! transition-all"
    :color="color"
  >
    <AppSideBarGroupItemIndicator :state="overState" />
    <v-list-item
      v-context-menu="getItems"
      v-shared-tooltip.right="() => group.name ? group.name : { list: instances.map(instance => instance.name || `Minecraft ${instance.runtime.minecraft}`) }"
      push
      link
      draggable
      class="non-moveable sidebar-item flex-1 flex-grow-0 px-2"
      @click="onClick"
      @dragover.prevent
      @dragstart="onDragStart"
      @dragend="onDragEnd"
      @dragover="onDragOver"
      @dragenter="onDragEnter"
      @dragleave="onDragLeave"
      @drop="onDrop"
    >
      <v-list-item-avatar
        size="48"
        class="transition-all duration-300 rounded"
        large
      >
        <Transition
          name="scroll-y-reverse-transition"
          mode="out-in"
        >
          <v-skeleton-loader
            v-if="dragging"
            type="avatar"
          />
          <div
            v-else
            class="grid cols-2 rows-2 gap-[2px] p-[2px] rounded-xl"
          >
            <v-img
              v-for="i in instances.slice(0, 4)"
              :key="i.path"
              :style="{ maxHeight: '20px', maxWidth: '20px' }"
              :src="getInstanceIcon(i, i.server ? undefined : undefined)"
              @dragenter="onDragEnter"
              @dragleave="onDragLeave"
            />
          </div>
        </Transition>
      </v-list-item-avatar>
      <v-list-item-title>{{ group.name || t('instances.folder') }}</v-list-item-title>
    </v-list-item>
  </v-sheet>
</template>
<script lang="ts" setup>
import { InstanceGroupData, useGroupDragDropState } from '@/composables/instanceGroup'
import { kInstances } from '@/composables/instances'
import { getInstanceIcon } from '@/util/favicon'
import { injection } from '@/util/inject'
import AppSideBarGroupItemIndicator from './AppSideBarGroupItemIndicator.vue'
import { notNullish } from '@vueuse/core'
import { vContextMenu } from '@/directives/contextMenu'
import { ContextMenuItem } from '@/composables/contextMenu'
import { useDialog } from '@/composables/dialog'
import { vSharedTooltip } from '@/directives/sharedTooltip'

const props = defineProps<{ group: InstanceGroupData; color: string }>()
const emit = defineEmits(['arrange', 'drop-save', 'group'])

const { instances: allInstances } = injection(kInstances)

const instances = computed(() => {
  const result = props.group.instances.map(path => allInstances.value.find(i => i.path === path)).filter(notNullish)
  return result
})

const onClick = () => {
  showFolderGrid(props.group)
}

const onDragStart = (e: DragEvent) => {
  e.dataTransfer!.setData('instance', props.group.id)
  e.dataTransfer!.setData('group', JSON.stringify(props.group))
  e.dataTransfer!.effectAllowed = 'move'
  e.dataTransfer!.dropEffect = 'move'
}

const { dragging, overState, onDragEnd, onDragEnter, onDragLeave, onDragOver, onDrop } = useGroupDragDropState(emit)

const { show: showFolderSetting } = useDialog('folder-setting')
const { show: showFolderGrid } = useDialog('folder-grid')
const { t } = useI18n()
const getItems = () => {
  const items: ContextMenuItem[] = [{
    icon: 'settings',
    text: t('instances.folderSetting'),
    onClick: () => {
      showFolderSetting(props.group)
    },
  }]
  return items
}
</script>
