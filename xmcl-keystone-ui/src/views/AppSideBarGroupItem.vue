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
          class="absolute left-0 max-h-1 min-h-1 min-w-full px-2"
          :style="{ top: overState === 0 ? '0' : '', bottom: overState === 2 ? '0' : '' }"
        >
          <div
            class="transition-300 max-h-1 min-h-1 min-w-full rounded transition-colors"
            :class="{ 'bg-yellow-400': dragover > 0, 'bg-transparent': dragover > 0 }"
          >
            {{ ' ' }}
          </div>
        </div>
        <v-list-item
          push
          link
          draggable
          class="non-moveable sidebar-item flex-1 flex-grow-0 px-2"
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
            <v-sheet
              v-if="!dragging"
              color="rgba(20,30,100,0.5)"
              class="grid cols-2 rows-2 gap-[2px] p-[2px]"
            >
              <v-img
                v-for="i in instance.slice(0, 4)"
                :key="i.path"
                :style="{ maxHeight: '20px', maxWidth: '20px' }"
                :src="getInstanceIcon(i, i.server ? undefined : undefined)"
                @dragenter="onDragEnter"
                @dragleave="onDragLeave"
              />
            </v-sheet>

            <v-skeleton-loader
              v-else
              type="avatar"
            />
          </v-list-item-avatar>
          <v-list-item-title>123</v-list-item-title>
        </v-list-item>
      </div>
    </template>
    {{ instance.map(instance => instance.name || `Minecraft ${instance.runtime.minecraft}`).join(', ') }}
  </v-tooltip>
</template>
<script lang="ts" setup>
import { kInstance } from '@/composables/instance'
import { useInstanceContextMenuItems } from '@/composables/instanceContextMenu'
import { getInstanceIcon } from '@/util/favicon'
import { injection } from '@/util/inject'
import { Instance } from '@xmcl/runtime-api'
import { useInstanceServerStatus } from '../composables/serverStatus'
import { vContextMenu } from '../directives/contextMenu'

const props = defineProps<{ instance: Instance[] }>()
const emit = defineEmits(['arrange', 'drop-save', 'group'])

const router = useRouter()
const { t } = useI18n()

const { select, path } = injection(kInstance)

const dragging = ref(false)
const dragover = ref(0)

// const { status } = useInstanceServerStatus(computed(() => props.instance))
// const favicon = computed(() => getInstanceIcon(props.instance, props.instance.server ? status.value : undefined))

// const getItems = useInstanceContextMenuItems(computed(() => props.instance))

const navigate = () => {
  // if (router.currentRoute.path !== '/') {
  //   router.push('/').then(() => {
  //     select(props.instance.path)
  //   })
  // } else {
  //   select(props.instance.path)
  // }
}

const onDragStart = (e: DragEvent) => {
  // const img = new Image(64, 64)
  // img.style.maxHeight = '54px'
  // img.style.maxWidth = '54px'
  // img.src = favicon.value
  // e.dataTransfer?.setDragImage(img, 0, 0)
  // e.dataTransfer!.effectAllowed = 'move'
  // e.dataTransfer!.dropEffect = 'move'
  // img.onload = () => {
  //   img.height = 54
  //   img.width = 54
  // }
  // e.dataTransfer!.setData('instance', props.instance.path)
  // dragging.value = true
}

const onDragEnd = (e: DragEvent) => {
  dragging.value = false
}

const onDragEnter = (e: DragEvent) => {
  if (e.dataTransfer?.items[0].type === 'instance') {
    dragover.value += 1
  }
}

enum OverState {
  TopQuad, // top 1/4
  Middle, // middle 1/2
  BottomQuad, // bottom 1/4
}
const overState = ref(undefined as OverState | undefined)

const getOverState = (e: DragEvent) => {
  // determine if this is drag on top 1/4 or bottom 1/4 of the target
  let state = undefined as OverState | undefined
  const rect = (e.target as HTMLElement).getBoundingClientRect()

  const y = e.clientY - rect.top
  const height = rect.height
  if (y < height / 4) {
    state = OverState.TopQuad
  } else if (y > (height / 4 * 3)) {
    state = OverState.BottomQuad
  } else {
    state = OverState.Middle
  }

  return state
}

const onDragOver = (e: DragEvent) => {
  overState.value = getOverState(e)
}

const onDragLeave = () => {
  dragover.value += -1
  if (dragover.value < 0) {
    dragover.value = 0
  }
}

const onDrop = (e: DragEvent) => {
  const targetPath = e.dataTransfer!.getData('instance')
  const savePath = e.dataTransfer?.getData('save')
  const topHalf = getOverState(e)
  if (targetPath) {
    if (topHalf === OverState.TopQuad) {
      emit('arrange', { targetPath, previous: true })
    } else if (topHalf === OverState.BottomQuad) {
      emit('arrange', { targetPath, previous: false })
    } else {
      emit('group', targetPath)
    }
  } else if (savePath) {
    // emit('drop-save', props.instance.path, savePath)
  }
  dragging.value = false
  dragover.value = 0
}

</script>
