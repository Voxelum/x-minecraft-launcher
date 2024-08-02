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
        color="purple lighten-4"
      >
        <AppSideBarGroupItemIndicator :state="overState" />
        <v-list-item
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
                class="grid cols-2 rows-2 gap-[2px] p-[2px]"
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
            v-for="instance in group.instances"
            :key="instance"
            :path="instance"
            inside
          />
        </template>
      </v-sheet>
    </template>
    {{ group.name || instances.map(instance => instance.name || `Minecraft ${instance.runtime.minecraft}`).join(', ') }}
  </v-tooltip>
</template>
<script lang="ts" setup>
import { InstanceGroupData, useGroupDragDropState } from '@/composables/instanceGroup'
import { kInstances } from '@/composables/instances'
import { getInstanceIcon } from '@/util/favicon'
import AppSideBarInstanceItem from './AppSideBarInstanceItem.vue'
import { injection } from '@/util/inject'
import AppSideBarGroupItemIndicator from './AppSideBarGroupItemIndicator.vue'

const props = defineProps<{ group: InstanceGroupData }>()
const emit = defineEmits(['arrange', 'drop-save', 'group'])

const { instances: allInstances } = injection(kInstances)

const instances = computed(() => {
  return props.group.instances.map(path => allInstances.value.find(i => i.path === path)!)
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

const { dragging, overState, onDragEnd, onDragEnter, onDragLeave, onDragOver, onDrop } = useGroupDragDropState(emit)
</script>
