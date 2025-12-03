<template>
  <div
    v-shared-tooltip="_ => name"
    v-context-menu.force="getContextMenuItems"
    class="flex flex-col items-center cursor-pointer rounded-lg p-2 transition-all duration-200 hover:bg-white/10 dark:hover:bg-black/20 flex-shrink-0"
    style="width: 100px;"
    @click="emit('click', $event)"
  >
    <v-img
      :src="image"
      width="64"
      height="64"
      class="rounded-lg flex-shrink-0"
    />
    <div
      class="mt-2 text-center text-sm truncate w-full"
      :title="name"
    >
      {{ name }}
    </div>
  </div>
</template>

<script lang="ts" setup>
import { vSharedTooltip } from '@/directives/sharedTooltip'
import { vContextMenu } from '@/directives/contextMenu'
import { getInstanceIcon } from '@/util/favicon'
import { Instance } from '@xmcl/instance'
import { useInstanceServerStatus } from '../composables/serverStatus'
import { useInstanceContextMenuItems } from '@/composables/instanceContextMenu'

const props = defineProps<{ instance: Instance }>()
const emit = defineEmits(['click'])

const { status } = useInstanceServerStatus(computed(() => props.instance))

const name = computed(() => props.instance.name || `Minecraft ${props.instance.runtime.minecraft}`)

const image = computed(() => {
  return getInstanceIcon(props.instance, props.instance.server ? status.value : undefined)
})

const getContextMenuItems = useInstanceContextMenuItems(computed(() => props.instance))
</script>
