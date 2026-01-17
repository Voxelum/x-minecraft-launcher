<template>
  <div class="relative group-item-wrapper">
    <AppSideBarGroupItemIndicator :state="overState" />
    <AppSideBarGroupItemIndicator :state="overState" />
    
    <v-list-item
      v-context-menu="getItems"
      v-shared-tooltip.right="() => group.name ? group.name : { list: instances.map(instance => instance.name || `Minecraft ${instance.runtime.minecraft}`) }"
      push
      link
      draggable
      class="non-moveable sidebar-item flex-1 flex-grow-0 px-2 group-list-item"
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
        class="transition-all duration-300"
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
            class="instance-grid"
          >
            <v-img
              v-for="i in instances.slice(0, 4)"
              :key="i.path"
              class="instance-grid-item"
              :src="getInstanceIcon(i, i.server ? undefined : undefined)"
              @dragenter="onDragEnter"
              @dragleave="onDragLeave"
            />
          </div>
          <v-icon v-else size="32">
            folder
          </v-icon>
        </Transition>
      </v-list-item-avatar>
      <v-list-item-title>{{ group.name || instances.length }}</v-list-item-title>
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
  </div>
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
import { vSharedTooltip } from '@/directives/sharedTooltip'

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

<style scoped>
/* Clean group wrapper */
.group-item-wrapper {
  background: transparent !important;
}

/* Remove all backgrounds from group items */
.group-list-item {
  background: transparent !important;
}

.group-list-item::before,
.group-list-item::after {
  display: none !important;
}

/* Instance grid for folder icons */
.instance-grid {
  display: grid;
  grid-template-columns: repeat(2, 1fr);
  grid-template-rows: repeat(2, 1fr);
  gap: 2px;
  padding: 2px;
  width: 48px;
  height: 48px;
}

.instance-grid-compact {
  width: 32px;
  height: 32px;
}

.instance-grid-item {
  width: 100%;
  height: 100%;
  border-radius: 4px;
  object-fit: cover;
}
</style>
