<template>
  <div
    class="flex flex-1 flex-grow-0 items-center text-gray-400"
    :class="{ 'text-gray-400': speed !== 0, 'text-transparent': speed === 0 }"
  >
    <v-icon
      class="mr-1 text-current"
    >
      downloading
    </v-icon>
    {{ speedText }}
  </div>
</template>
<script lang="ts" setup>
import { useTasks } from '../composables/task'
import { getExpectedSize } from '@/util/size'

const { throughput } = useTasks()
const speed = ref(0)
const speedText = computed(() => getExpectedSize(speed.value) + '/s')
setInterval(() => {
  speed.value = throughput.value
  throughput.value = 0
}, 1000)

</script>
