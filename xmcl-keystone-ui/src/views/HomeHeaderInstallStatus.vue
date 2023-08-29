<template>
  <div
    class="w-43 cursor-pointer select-none"
    @click="showTask()"
  >
    <span class="whitespace-nowrap text-center text-sm font-bold text-gray-400">
      {{ name }}
    </span>
    <v-progress-linear
      rounded
      color="blue"
      :value="percentage"
      height="6"
    />
    <span class="whitespace-nowrap text-center text-sm font-bold text-gray-400">
      {{ getExpectedSize(Math.abs(progress)) + ' / ' + getExpectedSize(Math.abs(total)) }}
    </span>
  </div>
</template>
<script lang="ts" setup>
import { getExpectedSize } from '@/util/size'
import { useDialog } from '../composables/dialog'

const props = defineProps<{
  name: string
  total: number
  progress: number
}>()
const { show: showTask } = useDialog('task')
const percentage = computed(() => props.progress / props.total * 100)
</script>
