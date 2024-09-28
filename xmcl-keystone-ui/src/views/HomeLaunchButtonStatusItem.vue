<template>
  <div
    v-if="item"
    v-shared-tooltip="_ => item ? item.title : ''"
    class="ml-2 transition-opacity duration-500 select-none h-full flex whitespace-nowrap text-sm font-bold flex-col overflow-hidden text-ellipsis"
    :style="{
      opacity: active ? '1' : '0.5',
      cursor: item?.onClick ? 'pointer' : 'unset',
    }"
    style="cursor: unset"
    @mouseenter="emit('mouseenter')"
    @mouseleave="emit('mouseleave')"
    @click="item?.onClick?.()"
  >
    <div
      class=" overflow-hidden text-ellipsis"
      :style="{ color: item.color ?? '' }"
    >
      {{ item.title }}
    </div>
    <div class="text-gray-400 overflow-hidden text-ellipsis">
      {{ item.description }}
    </div>
  </div>
</template>
<script lang="ts" setup>
import { LaunchMenuItem } from '@/composables/launchButton'
import { vSharedTooltip } from '@/directives/sharedTooltip'

defineProps<{ active?: boolean; item?: LaunchMenuItem }>()
const emit = defineEmits(['mouseenter', 'mouseleave'])

</script>
