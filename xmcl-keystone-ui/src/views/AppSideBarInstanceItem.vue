<template>
  <v-tooltip
    :close-delay="0"
    color="black"
    transition="scroll-x-transition"
    right
  >
    <template #activator="{ on: tooltip }">
      <div class="relative">
        <AppSideBarGroupItemIndicator :state="overState" />

        <v-list-item
          v-context-menu="getItems"
          push
          link
          draggable
          class="non-moveable sidebar-item flex-1 flex-grow-0 px-2"
          :class="{ 'v-list-item--active': path === selectedInstance }"
          v-on="tooltip"
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
          <v-list-item-title>{{ instance.name }}</v-list-item-title>
        </v-list-item>
      </div>
    </template>
    {{ instance.name || `Minecraft ${instance.runtime.minecraft}` }}
    <div>
      <v-avatar size="28">
        <img :src="BuiltinImages.minecraft">
      </v-avatar>
      {{ instance.runtime.minecraft }}

      <span v-if="instance.runtime.forge">
        <v-avatar size="28">
          <img :src="BuiltinImages.forge">
        </v-avatar>
        {{ instance.runtime.forge }}
      </span>
      <span v-if="instance.runtime.labyMod">
        <v-avatar size="28">
          <img :src="BuiltinImages.labyMod">
        </v-avatar>
        {{ instance.runtime.labyMod }}
      </span>
      <span v-if="instance.runtime.neoForged">
        <v-avatar size="28">
          <img :src="BuiltinImages.neoForged">
        </v-avatar>
        {{ instance.runtime.neoForged }}
      </span>
      <span v-if="instance.runtime.fabricLoader">
        <v-avatar size="28">
          <img :src="BuiltinImages.fabric">
        </v-avatar>
        {{ instance.runtime.fabricLoader }}
      </span>
      <span v-if="instance.runtime.quiltLoader">
        <v-avatar size="28">
          <img :src="BuiltinImages.quilt">
        </v-avatar>
        {{ instance.runtime.quiltLoader }}
      </span>
      <span v-if="instance.runtime.optifine">
        <v-avatar size="28">
          <img :src="BuiltinImages.optifine">
        </v-avatar>
        {{ instance.runtime.optifine }}
      </span>
    </div>
  </v-tooltip>
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

const props = defineProps<{
  path: string
  inside?: boolean
}>()
const emit = defineEmits(['arrange', 'drop-save', 'group'])

const { instances, selectedInstance } = injection(kInstances)
const instance = computed(() => instances.value.find((i) => i.path === props.path)!)

const router = useRouter()

const { select } = injection(kInstance)

const { status } = useInstanceServerStatus(instance)
const favicon = computed(() => getInstanceIcon(instance.value, instance.value.server ? status.value : undefined))

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
  const img = new Image(64, 64)
  img.style.maxHeight = '54px'
  img.style.maxWidth = '54px'
  img.src = favicon.value
  e.dataTransfer?.setDragImage(img, 0, 0)
  e.dataTransfer!.effectAllowed = 'move'
  e.dataTransfer!.dropEffect = 'move'
  img.onload = () => {
    img.height = 54
    img.width = 54
  }
  e.dataTransfer!.setData('instance', props.path)
  dragging.value = true
}

const { dragging, overState, onDragEnd, onDragEnter, onDragLeave, onDragOver, onDrop } = useGroupDragDropState(emit)

</script>
