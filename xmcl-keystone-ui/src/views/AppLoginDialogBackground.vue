<template>
  <Particles
    v-if="value"
    class="absolute h-full w-full"
    :move-direction="direction"
    :move-enabled="value"
    :line-linked="false"
    :move-random="true"
    :particle-size="3"
    :move-speed="6"
    :opacity-random="true"
    :hover-effect="false"
    :click-effect="false"
  />
</template>
<script lang="ts" setup>
import Particles from '@/components/Particles.vue'

const props = defineProps<{
  value: boolean
  seed: number
}>()

const direction = ref('top')
function nextDirection() {
  const dirs = ['top', 'right', 'left', 'bottom', 'top-right', 'top-left', 'bottom-left', 'bottom-right']
  const i = Math.round(Math.random() * dirs.length)
  direction.value = dirs[i]
}
watch(() => props.seed, () => { nextDirection() })
</script>
