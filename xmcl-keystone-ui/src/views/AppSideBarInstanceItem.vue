<template>
  <div class="relative sidebar-instance-wrapper">
    <AppSideBarGroupItemIndicator :state="overState" />
    <div
      v-context-menu="getItems"
      v-shared-tooltip.right="() => ({ text: name, items: runtimes })"
      data-testid="instance-item"
      class="sidebar-instance non-moveable"
      :class="{ 'sidebar-instance--active': isActive }"
      role="button"
      tabindex="0"
      :aria-label="name"
      :aria-pressed="isActive"
      draggable="true"
      @click="navigate"
      @keydown.enter.prevent="navigate"
      @keydown.space.prevent="navigate"
      @dragover.prevent
      @dragstart="onDragStart"
      @dragend="onDragEnd"
      @dragover="onDragOver"
      @dragenter="onDragEnter"
      @dragleave="onDragLeave"
      @drop.prevent="onDrop"
    >
      <span class="sidebar-instance__indicator" />
      <span class="sidebar-instance__content">
        <v-img
          v-if="!dragging"
          class="sidebar-instance__image"
          :width="48"
          :height="48"
          :src="favicon"
          draggable="false"
        />
        <v-skeleton-loader
          v-else
          type="avatar"
        />
      </span>
    </div>
    <!-- Pin indicator -->
    <div
      v-if="pinned"
      class="absolute -top-1 right-1 w-4 h-4 bg-yellow-500 rounded-full flex items-center justify-center shadow-md z-20 pointer-events-none"
    >
      <v-icon color="white" :size="10">
        push_pin
      </v-icon>
    </div>
  </div>
</template>
<script lang="ts" setup>
import { kInstance } from '@/composables/instance'
import { useInstanceContextMenuItems } from '@/composables/instanceContextMenu'
import { getInstanceIcon } from '@/util/favicon'
import { injection } from '@/util/inject'
import { useInstanceServerStatus } from '../composables/serverStatus'
import { vContextMenu } from '../directives/contextMenu'
import { BuiltinImages } from '../constant'
import { kInstances } from '@/composables/instances'
import AppSideBarGroupItemIndicator from './AppSideBarGroupItemIndicator.vue'
import { isDraggingInstance, useGroupDragDropState } from '@/composables/instanceGroup'
import { vSharedTooltip } from '@/directives/sharedTooltip'

const props = defineProps<{
  path: string
  inside?: boolean
  pinned?: boolean
}>()
const emit = defineEmits(['arrange', 'drop-save', 'group', 'toggle-pin'])

const { instances, selectedInstance } = injection(kInstances)
const instance = computed(() => instances.value.find((i) => i.path === props.path))
const name = computed(() => {
  if (!instance.value) return ''
  if (instance.value.name) return instance.value.name
  if (instance.value.runtime.minecraft) return `Minecraft ${instance.value.runtime.minecraft}`
  return ''
})
const runtimes = computed(() => {
  const inst = instance.value
  if (!inst) return []
  const iconAndVersion = [] as { icon: string; text: string }[]
  if (inst.runtime.minecraft) iconAndVersion.push({ icon: BuiltinImages.minecraft, text: inst.runtime.minecraft })
  if (inst.runtime.forge) iconAndVersion.push({ icon: BuiltinImages.forge, text: inst.runtime.forge })
  if (inst.runtime.labyMod) iconAndVersion.push({ icon: BuiltinImages.labyMod, text: inst.runtime.labyMod })
  if (inst.runtime.neoForged) iconAndVersion.push({ icon: BuiltinImages.neoForged, text: inst.runtime.neoForged })
  if (inst.runtime.fabricLoader) iconAndVersion.push({ icon: BuiltinImages.fabric, text: inst.runtime.fabricLoader })
  if (inst.runtime.quiltLoader) iconAndVersion.push({ icon: BuiltinImages.quilt, text: inst.runtime.quiltLoader })
  if (inst.runtime.optifine) iconAndVersion.push({ icon: BuiltinImages.optifine, text: inst.runtime.optifine })
  return iconAndVersion
})

const router = useRouter()

const { select } = injection(kInstance)

const { status } = useInstanceServerStatus(instance)
const favicon = computed(() => {
  const inst = instance.value
  if (!inst) return ''
  return getInstanceIcon(inst, inst.server ? status.value : undefined)
})

const getItems = useInstanceContextMenuItems(instance)

const route = useRoute()
const isActive = computed(() => {
  if (props.path !== selectedInstance.value) return false
  // Active when the current route is hosted by the instance HomeLayout
  // (e.g. '/', '/mods', '/save', '/resourcepacks', '/shaderpacks', '/base-setting')
  return route.matched[0]?.path === '/'
})

const navigate = () => {
  if (router.currentRoute.value.path !== '/') {
    router.push('/').then(() => {
      select(props.path)
    })
  } else {
    select(props.path)
  }
}

const onDragStart = (e: DragEvent) => {
  const img = new Image(54, 54)
  img.style.maxHeight = '54px'
  img.style.maxWidth = '54px'
  img.src = favicon.value
  e.dataTransfer?.setDragImage(img, 0, 0)
  e.dataTransfer!.effectAllowed = 'move'
  e.dataTransfer!.dropEffect = 'move'
  img.onload = () => {
    img.height = 54
    img.width = 54
    img.style.maxHeight = '54px'
    img.style.maxWidth = '54px'
  }
  e.dataTransfer!.setData('instance', props.path)
  dragging.value = true
  isDraggingInstance.value = true
}

const { dragging, overState, onDragEnd, onDragEnter, onDragLeave, onDragOver, onDrop } = useGroupDragDropState(emit, computed(() => props.inside))
</script>

<style scoped>
.sidebar-instance-wrapper {
  position: relative;
  width: 100%;
  height: 56px; /* 48px content + 4px top + 4px bottom margin */
  flex-shrink: 0;
  display: flex;
  align-items: center;
  justify-content: center;
}

.sidebar-instance {
  position: relative;
  display: block;
  width: 48px;
  height: 48px;
  cursor: pointer;
}

.sidebar-instance__content {
  position: relative;
  display: flex;
  align-items: center;
  justify-content: center;
  width: 48px;
  height: 48px;
  border-radius: 50%;
  overflow: hidden;
  background-color: transparent;
  transition:
    border-radius 0.2s cubic-bezier(0.4, 0, 0.2, 1),
    box-shadow 0.2s cubic-bezier(0.4, 0, 0.2, 1);
  /* The avatar is purely decorative during drag operations - the wrapping
     div is the only drop target. */
  pointer-events: none;
}

/* But still allow click + context menu when not dragging */
.sidebar-instance:hover .sidebar-instance__content,
.sidebar-instance--active .sidebar-instance__content {
  border-radius: 16px;
}

.sidebar-instance--active .sidebar-instance__content {
  box-shadow: 0 0 0 2px var(--color-primary);
}

.sidebar-instance__image {
  width: 100%;
  height: 100%;
  pointer-events: none;
  user-select: none;
  -webkit-user-drag: none;
}

.sidebar-instance__indicator {
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

.sidebar-instance:hover .sidebar-instance__indicator {
  height: 20px;
}

.sidebar-instance--active .sidebar-instance__indicator {
  height: 36px;
}
</style>
