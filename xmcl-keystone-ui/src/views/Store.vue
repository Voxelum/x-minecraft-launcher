<template>
  <div class="store visible-scroll relative flex flex-col items-center overflow-auto">
    <router-view
      v-slot="{ Component }"
      class="flex flex-col"
    >
      <Transition
        name="slide-y-transition"
        mode="out-in"
        @after-enter="end"
        @leave="start"
      >
        <component :is="Component" />
      </Transition>
    </router-view>
  </div>
</template>
<script setup lang="ts">
import { useBlockSharedTooltip } from '@/composables/sharedTooltip'
const { start, end } = useBlockSharedTooltip()
</script>

<style>
.store {
  .v-window__container {
    max-height: 360px;
  }
  .v-carousel__controls {
    position: static !important;
  }
}

</style>
