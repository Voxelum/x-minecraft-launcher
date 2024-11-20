<template>
  <div class="relative">
    <AppSideBarGroupItemIndicator :state="overState" />
    <v-list-item
      v-context-menu="getItems"
      v-shared-tooltip.right="() => ({ text: name, items: runtimes })"
      push
      link
      draggable
      class="non-moveable sidebar-item flex-1 flex-grow-0 px-2"
      :class="{ 'v-list-item--active': path === selectedInstance }"
      @click="navigate"
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
        class="transition-all duration-300 hover:rounded"
        large
      >
        <v-img
          v-if="!dragging"
          width="54"
          height="54"
          :src="favicon"
          @dragenter="onDragEnter"
          @dragleave="onDragLeave"
        />
        <v-skeleton-loader
          v-else
          type="avatar"
        />
      </v-list-item-avatar>
      <v-list-item-title>{{ name }}</v-list-item-title>
    </v-list-item>
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
import { useGroupDragDropState } from '@/composables/instanceGroup'
import { vSharedTooltip } from '@/directives/sharedTooltip'

const props = defineProps<{
  path: string
  inside?: boolean
}>()
const emit = defineEmits(['arrange', 'drop-save', 'group'])

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

const navigate = () => {
  if (router.currentRoute.path !== '/') {
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
}

const { dragging, overState, onDragEnd, onDragEnter, onDragLeave, onDragOver, onDrop } = useGroupDragDropState(emit, computed(() => props.inside))

</script>
