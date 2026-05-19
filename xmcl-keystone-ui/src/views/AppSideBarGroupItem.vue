<template>
  <div
    class="relative sidebar-group-wrapper"
    :class="{ 'sidebar-group-wrapper--expanded': expanded }"
    :style="{ '--sidebar-group-color': color }"
  >
    <AppSideBarGroupItemIndicator :state="overState" />
    <AppSideBarGroupItemIndicator :state="overState" />

    <div
      v-context-menu="getItems"
      v-shared-tooltip.right="() => group.name ? group.name : { list: instances.map(instance => instance.name || `Minecraft ${instance.runtime.minecraft}`) }"
      class="sidebar-group non-moveable"
      role="button"
      tabindex="0"
      :aria-label="group.name || 'Instance group'"
      :aria-expanded="expanded"
      draggable="true"
      @click="onClick"
      @keydown.enter.prevent="onClick"
      @keydown.space.prevent="onClick"
      @dragover.prevent
      @dragstart="onDragStart"
      @dragend="onDragEnd"
      @dragover="onDragOver"
      @dragenter="onDragEnter"
      @dragleave="onDragLeave"
      @drop.prevent="onDrop"
    >
      <span class="sidebar-group__indicator" />
      <span class="sidebar-group__content">
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
              draggable="false"
            />
          </div>
          <v-icon
            v-else
            :size="32"
            :color="color"
          >
            folder_open
          </v-icon>
        </Transition>
      </span>
    </div>
    <div
      v-if="expanded"
      class="sidebar-group__items"
    >
      <AppSideBarInstanceItem
        v-for="(instance, index) in group.instances"
        :key="instance + index"
        :path="instance"
        inside
        @arrange="emit('arrange', { ...$event, toPath: instance })"
      />
    </div>
  </div>
</template>
<script lang="ts" setup>
import { isDraggingInstance, useGroupDragDropState } from '@/composables/instanceGroup'
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
import { InstanceGroupData } from '@xmcl/runtime-api'

const props = defineProps<{ group: InstanceGroupData; color: string }>()
const emit = defineEmits(['arrange', 'drop-save', 'group', 'setting'])

const { instances: allInstances } = injection(kInstances)

const instances = computed(() => {
  const result = props.group.instances.map(path => allInstances.value.find(i => i.path === path)).filter(notNullish)
  return result
})
const expanded = ref(false)

const onClick = () => {
  expanded.value = !expanded.value
}

const onDragStart = (e: DragEvent) => {
  e.dataTransfer!.setData('instance', props.group.id)
  e.dataTransfer!.setData('group', JSON.stringify(props.group))
  e.dataTransfer!.effectAllowed = 'move'
  e.dataTransfer!.dropEffect = 'move'
  isDraggingInstance.value = true
}

const { dragging, overState, onDragEnd, onDragEnter, onDragLeave, onDragOver, onDrop } = useGroupDragDropState(emit)

const { show } = useDialog('folder-setting')
const { t } = useI18n()

const mutableState = reactive({
  name: props.group.name,
  color: props.group.color,
})
watch(() => [props.group.name, props.group.color], ([name, color]) => {
  mutableState.name = name
  mutableState.color = color
})
watch(
  mutableState,
  (state) => {
    if (state.name !== props.group.name || state.color !== props.group.color) {
      emit('setting', { id: props.group.id, name: state.name, color: state.color })
    }
  },
  { deep: true },
)

const getItems = () => {
  const items: ContextMenuItem[] = [{
    icon: 'settings',
    text: t('instances.folderSetting'),
    onClick: () => {
      show(mutableState)
    },
  }]
  return items
}
</script>

<style scoped>
.sidebar-group-wrapper {
  position: relative;
  display: flex;
  flex-direction: column;
  align-items: stretch;
  --sidebar-group-color: var(--color-primary);
  transition:
    background-color 0.25s cubic-bezier(0.4, 0, 0.2, 1),
    padding 0.25s cubic-bezier(0.4, 0, 0.2, 1),
    margin 0.25s cubic-bezier(0.4, 0, 0.2, 1);
}

/* Discord-like folder container when expanded */
.sidebar-group-wrapper--expanded {
  background-color: color-mix(in srgb, var(--sidebar-group-color) 18%, transparent);
  border-radius: 20px;
  width: 56px;
  align-self: center;
  padding: 4px 0 8px;
  margin: 4px 0;
}

.sidebar-group {
  position: relative;
  display: flex;
  align-items: center;
  justify-content: center;
  width: 100%;
  height: 56px;
  cursor: pointer;
  flex-shrink: 0;
}

.sidebar-group__content {
  position: relative;
  display: flex;
  align-items: center;
  justify-content: center;
  width: 48px;
  height: 48px;
  border-radius: 16px;
  overflow: hidden;
  color: var(--sidebar-group-color);
  background-color: color-mix(in srgb, var(--sidebar-group-color) 25%, transparent);
  transition:
    background-color 0.2s cubic-bezier(0.4, 0, 0.2, 1),
    color 0.2s cubic-bezier(0.4, 0, 0.2, 1);
  pointer-events: none;
}

.sidebar-group:hover .sidebar-group__content {
  background-color: color-mix(in srgb, var(--sidebar-group-color) 60%, transparent);
}

/* Keep the folder header at the regular item size when expanded,
   only swap the background to a transparent (header-style) look */
.sidebar-group-wrapper--expanded .sidebar-group__content {
  background-color: transparent;
}

.sidebar-group-wrapper--expanded .sidebar-group:hover .sidebar-group__content {
  background-color: color-mix(in srgb, var(--sidebar-group-color) 40%, transparent);
}

.sidebar-group__indicator {
  position: absolute;
  left: -12px;
  top: 50%;
  width: 4px;
  height: 0;
  border-radius: 0 4px 4px 0;
  background-color: white;
  transform: translateY(-50%);
  transition: height 0.2s cubic-bezier(0.4, 0, 0.2, 1);
  opacity: 0.85;
  pointer-events: none;
}

.sidebar-group:hover .sidebar-group__indicator {
  height: 20px;
}

/* Items inside the expanded folder */
.sidebar-group__items {
  display: flex;
  flex-direction: column;
  gap: 4px;
  padding: 0;
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

.instance-grid-item {
  width: 100%;
  height: 100%;
  border-radius: 4px;
  object-fit: cover;
  pointer-events: none;
  user-select: none;
  -webkit-user-drag: none;
}
</style>
