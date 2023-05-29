<template>
  <v-tooltip
    :close-delay="0"
    color="black"
    transition="scroll-x-transition"
    right
  >
    <template #activator="{ on: tooltip }">
      <div class="relative">
        <div
          class="absolute px-2 left-0 min-w-full min-h-1 max-h-1"
        >
          <div
            class="transition-colors transition-300 min-w-full min-h-1 max-h-1 rounded"
            :class="{ 'bg-yellow-400': dragover > 0, 'bg-transparent': dragover > 0 }"
          >
            {{ ' ' }}
          </div>
        </div>
        <v-list-item
          v-context-menu="items"
          push
          link
          draggable
          class="px-2 flex-grow-0 flex-1 non-moveable sidebar-item"
          :class="{'v-list-item--active': path === instance.path}"
          v-on="tooltip"
          @click="navigate"
          @dragover.prevent
          @dragstart="onDragStart"
          @dragend="onDragEnd"
          @dragenter="onDragEnter"
          @dragleave="onDragLeave"
          @drop="onDrop"
        >
          <v-list-item-avatar
            size="48"
            class="hover:rounded transition-all duration-300"
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
              type="avatar"
            />
          </v-list-item-avatar>
          <v-list-item-title>{{ instance.name }}</v-list-item-title>
        </v-list-item>
      </div>
    </template>
    {{ instance.name }}
    <div>
      <v-avatar
        size="28"
      >
        <img
          :src="'image://builtin/minecraft'"
        >
      </v-avatar>
      {{ instance.runtime.minecraft }}

      <span v-if="instance.runtime.forge">
        <v-avatar
          size="28"
        >
          <img
            :src="'image://builtin/forge'"
          >
        </v-avatar>
        {{ instance.runtime.forge }}
      </span>
      <span v-if="instance.runtime.fabricLoader">
        <v-avatar
          size="28"
        >
          <img
            :src="'image://builtin/fabric'"
          >
        </v-avatar>
        {{ instance.runtime.fabricLoader }}
      </span>
      <span v-if="instance.runtime.quiltLoader">
        <v-avatar
          size="28"
        >
          <img
            :src="'image://builtin/quilt'"
          >
        </v-avatar>
        {{ instance.runtime.quiltLoader }}
      </span>

      <span v-if="instance.runtime.optifine">
        <v-avatar
          size="28"
        >
          <img
            :src="'image://builtin/optifine'"
          >
        </v-avatar>
        {{ instance.runtime.optifine }}
      </span>
    </div>
  </v-tooltip>
</template>
<script lang="ts" setup>
import { kInstance } from '@/composables/instance'
import { getInstanceIcon } from '@/util/favicon'
import { injection } from '@/util/inject'
import { Instance } from '@xmcl/runtime-api'
import { ContextMenuItem } from '../composables/contextMenu'
import { useDialog } from '../composables/dialog'
import { useInstanceServerStatus } from '../composables/serverStatus'
import { vContextMenu } from '../directives/contextMenu'

const props = defineProps<{ instance: Instance }>()
const emit = defineEmits(['drop'])

const router = useRouter()
const { t } = useI18n()

const { select, path } = injection(kInstance)
const { show: showDeleteDialog } = useDialog('delete-instance')
const { status } = useInstanceServerStatus(computed(() => props.instance))

const dragging = ref(false)
const dragover = ref(0)

const favicon = computed(() => getInstanceIcon(props.instance, status.value))

const items = computed(() => {
  const result: ContextMenuItem[] = [
    {
      text: t('instance.delete'),
      color: 'red',
      icon: 'delete',
      onClick() {
        showDeleteDialog({ name: props.instance.name, path: props.instance.path })
      },
    },
  ]
  return result
})

const navigate = () => {
  if (router.currentRoute.path !== '/') {
    router.push('/').then(() => {
      select(props.instance.path)
    })
  } else {
    select(props.instance.path)
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
  e.dataTransfer!.setData('instance', props.instance.path)
  dragging.value = true
}

const onDragEnd = (e: DragEvent) => {
  dragging.value = false
}

const onDragEnter = (e: DragEvent) => {
  dragover.value += 1
}

const onDragLeave = () => {
  dragover.value += -1
}

const onDrop = (e: DragEvent) => {
  const targetPath = e.dataTransfer!.getData('instance')
  emit('drop', targetPath)
  dragging.value = false
  dragover.value = 0
}

</script>
