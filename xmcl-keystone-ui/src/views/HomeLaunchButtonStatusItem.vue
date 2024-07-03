<template>
  <div
    class="ml-2 transition-opacity duration-500 select-none h-full flex flex-grow-0 whitespace-nowrap text-sm font-bold flex-col max-w-40 lg:max-w-full overflow-hidden text-ellipsis"
    :style="{
      opacity: active ? '1' : '0.5',
    }"
    style="cursor: unset"
    @mouseenter="emit('mouseenter')"
    @mouseleave="emit('mouseleave')"
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

defineProps<{ active?: boolean; item: LaunchMenuItem }>()
const emit = defineEmits(['mouseenter', 'mouseleave'])

</script>
