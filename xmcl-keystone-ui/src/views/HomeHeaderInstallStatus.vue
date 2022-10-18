<template>
  <div
    class="cursor-pointer select-none w-43"
    @click="showTask()"
  >
    <span class="text-gray-400 text-sm font-bold text-center whitespace-nowrap">
      {{ name }}
    </span>
    <v-progress-linear
      rounded
      color="blue"
      :value="percentage"
      height="6"
    />
    <span class="text-gray-400 text-sm font-bold text-center whitespace-nowrap">
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
