<template>
  <div
    v-if="speedText"
    class="flex flex-1 flex-grow-0 items-center"
    :class="{ 'text-gray-400': speedText, 'text-transparent': !speedText }"
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
import { kNetworkStatus } from '@/composables/useNetworkStatus'
import { injection } from '@/util/inject'
import { getExpectedSize } from '@/util/size'

const { status } = injection(kNetworkStatus)
const speedText = computed(() => status.value?.downloadSpeed ? getExpectedSize(status.value?.downloadSpeed) + '/s' : '')

</script>
