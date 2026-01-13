<template>
  <div class="h-full w-full">
    <component :is="component" />
  </div>
</template>

<script setup lang="ts">
import { computed } from 'vue'
import { useMarketLayout } from '@/composables/marketLayout'
import StoreEntryClassic from './StoreEntryClassic.vue'
import StoreEntryModern from './StoreEntryModern.vue'

const layout = useMarketLayout()
provide('layout', layout)
const component = computed(() => {
  return layout.value === 'modern' ? StoreEntryModern : StoreEntryClassic
})
</script>
