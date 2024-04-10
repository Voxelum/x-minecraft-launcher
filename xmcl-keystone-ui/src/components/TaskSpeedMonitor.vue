<template>
  <div
    v-if="speed !== 0"
    class="flex flex-1 flex-grow-0 items-center"
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
import { kTaskManager } from '@/composables/taskManager'
import { injection } from '@/util/inject'
import { getExpectedSize } from '@/util/size'

const { throughput } = injection(kTaskManager)
const speed = ref(0)
const speedText = computed(() => getExpectedSize(speed.value) + '/s')
setInterval(() => {
  speed.value = throughput.value
  throughput.value = 0
}, 1000)

</script>
