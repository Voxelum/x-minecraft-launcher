<template>
  <div
    class="relative sidebar-group-wrapper"
    :class="{ 'sidebar-group-wrapper--expanded': expanded }"
    :style="{
      '--sidebar-group-color': getBaseColor(color),
      '--sidebar-group-bg': color,
    }"
  >
    <AppSideBarGroupItemIndicator :state="overState" />
    <AppSideBarGroupItemIndicator :state="overState" />

    <div
      v-context-menu="getItems"
      v-shared-tooltip.right="() => group.name ? group.name : { list: instances.map(instance => instance.name || `Minecraft ${instance.runtime.minecraft}`) }"
      class="sidebar-group non-moveable"
      :data-gradient="isGradient(color)"
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
            class="instance-icon-container"
          >
            <template v-if="group.icon">
              <v-img
                v-if="isImageUrl(group.icon)"
                :src="group.icon"
                class="instance-custom-img"
                draggable="false"
              />
              <v-icon
                v-else
                :size="30"
                :color="color ? 'white' : 'primary'"
                class="group-folder-icon"
              >
                {{ group.icon }}
              </v-icon>
            </template>
            <div
              v-else
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
          </div>
          <div
            v-else
            class="instance-icon-container"
          >
            <v-img
              v-if="group.icon && isImageUrl(group.icon)"
              :src="group.icon"
              class="instance-custom-img"
              draggable="false"
            />
            <v-icon
              v-else
              :size="32"
              :color="color ? 'white' : 'primary'"
              class="group-folder-icon"
            >
              {{ group.icon || 'folder_open' }}
            </v-icon>
          </div>
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

function isImageUrl(val?: string): boolean {
  if (!val) return false
  return val.startsWith('http://') || val.startsWith('https://') || val.startsWith('data:image/') || val.startsWith('image://')
}

function isGradient(val?: string): boolean {
  if (!val) return false
  return val.includes('gradient')
}

function getBaseColor(val?: string, fallback = '#10B981'): string {
  if (!val) return fallback
  if (!isGradient(val)) return val
  const match = val.match(/#(?:[0-9a-fA-F]{3,8})|rgba?\([^)]+\)/)
  return match ? match[0] : fallback
}

const mutableState = reactive({
  name: props.group.name,
  color: props.group.color,
  icon: props.group.icon || '',
  hasIcon: true,
})
watch(() => [props.group.name, props.group.color, props.group.icon], ([name, color, icon]) => {
  mutableState.name = name || ''
  mutableState.color = color || ''
  mutableState.icon = icon || ''
})
watch(
  mutableState,
  (state) => {
    if (state.name !== props.group.name || state.color !== props.group.color || state.icon !== (props.group.icon || '')) {
      emit('setting', { id: props.group.id, name: state.name, color: state.color, icon: state.icon })
    }
  },
  { deep: true },
)

const getItems = () => {
  const items: ContextMenuItem[] = [{
    icon: 'settings',
    text: t('instances.folderSetting'),
    onClick: () => {
      show({
        ...mutableState,
        onSave: (saved: { name: string; color: string; icon: string }) => {
          emit('setting', { id: props.group.id, name: saved.name, color: saved.color, icon: saved.icon })
        },
      })
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

.sidebar-group[data-gradient="true"] .sidebar-group__content {
  background-image: var(--sidebar-group-bg);
  opacity: 0.9;
}

.sidebar-group[data-gradient="true"]:hover .sidebar-group__content {
  opacity: 1;
  filter: brightness(1.15);
}

.sidebar-group[data-gradient="true"] .sidebar-group__indicator {
  background: var(--sidebar-group-bg);
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

.instance-icon-container {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 48px;
  height: 48px;
}

.instance-custom-img {
  width: 44px;
  height: 44px;
  border-radius: 12px;
  object-fit: cover;
  pointer-events: none;
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

.group-folder-icon {
  filter: drop-shadow(0 1px 3px rgba(0, 0, 0, 0.6));
}

.group-folder-icon :deep(img) {
  filter: drop-shadow(0 1px 2px rgba(0, 0, 0, 0.6)) brightness(1.2) contrast(1.1);
}
</style>
