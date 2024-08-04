<template>
  <v-tooltip
    :close-delay="0"
    color="black"
    transition="scroll-x-transition"
    right
  >
    <template #activator="{ on: tooltip }">
      <v-sheet
        class="relative rounded-xl hover:rounded-lg! transition-all"
        :color="color"
      >
        <AppSideBarGroupItemIndicator :state="overState" />
        <v-list-item
          v-context-menu="getItems"
          push
          link
          draggable
          class="non-moveable sidebar-item flex-1 flex-grow-0 px-2"
          v-on="tooltip"
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
                v-else-if="!expanded"
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
              <v-icon v-else>
                folder
              </v-icon>
            </Transition>
          </v-list-item-avatar>
          <v-list-item-title>123</v-list-item-title>
        </v-list-item>
        <template v-if="expanded">
          <AppSideBarInstanceItem
            v-for="(instance, index) in group.instances"
            :key="instance + index"
            :path="instance"
            inside
            @arrange="emit('arrange', { ...$event, toPath: instance })"
          />
        </template>
      </v-sheet>
    </template>
    <template v-if="group.name">
      {{ group.name }}
    </template>
    <template v-else>
      <ul>
        <li
          v-for="instance in instances"
          :key="instance.path"
        >
          {{ instance.name || `Minecraft ${instance.runtime.minecraft}` }}
        </li>
      </ul>
    </template>
  </v-tooltip>
</template>
<script lang="ts" setup>
import { InstanceGroupData, useGroupDragDropState } from '@/composables/instanceGroup'
import { kInstances } from '@/composables/instances'
import { getInstanceIcon } from '@/util/favicon'
import AppSideBarInstanceItem from './AppSideBarInstanceItem.vue'
import { injection } from '@/util/inject'
import AppSideBarGroupItemIndicator from './AppSideBarGroupItemIndicator.vue'
import { notNullish } from '@vueuse/core'
import { vContextMenu } from '@/directives/contextMenu'
import { ContextMenuItem } from '@/composables/contextMenu'
import { useDialog } from '@/composables/dialog'

const props = defineProps<{ group: InstanceGroupData; color: string }>()
const emit = defineEmits(['arrange', 'drop-save', 'group'])

const { instances: allInstances } = injection(kInstances)

const instances = computed(() => {
  const result = props.group.instances.map(path => allInstances.value.find(i => i.path === path)).filter(notNullish)
  return result
})
const expanded = ref(false)

const onClick = () => {
  if (expanded.value) {
    expanded.value = false
  } else {
    expanded.value = true
  }
}

const onDragStart = (e: DragEvent) => {
  e.dataTransfer!.setData('instance', props.group.id)
  e.dataTransfer!.setData('group', JSON.stringify(props.group))
  e.dataTransfer!.effectAllowed = 'move'
  e.dataTransfer!.dropEffect = 'move'
}

const { dragging, overState, onDragEnd, onDragEnter, onDragLeave, onDragOver, onDrop } = useGroupDragDropState(emit)

const { show } = useDialog('folder-setting')
const { t } = useI18n()
const getItems = () => {
  const items: ContextMenuItem[] = [{
    icon: 'settings',
    text: t('instances.folderSetting'),
    onClick: () => {
      show(props.group)
    },
  }]
  return items
}
</script>
