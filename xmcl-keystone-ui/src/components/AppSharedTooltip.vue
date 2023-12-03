<template>
  <v-tooltip
    v-model="isShown"
    :color="data?.color"
    transition="scroll-y-reverse-transition"
    :position-x="data?.x"
    :position-y="data?.y"
    class="z-100"
    :top="top"
    :left="left"
    :right="right"
    :bottom="bottom"
  >
    {{ data?.text }}
  </v-tooltip>
</template>

<script lang="ts" setup>
import { useSharedTooltipData } from '@/composables/sharedTooltip'

const { data, isShown } = useSharedTooltipData()
const top = computed(() => data.value?.direction === 'top')
const left = computed(() => data.value?.direction === 'left')
const right = computed(() => data.value?.direction === 'right')
const bottom = computed(() => data.value?.direction === 'bottom')

</script>
