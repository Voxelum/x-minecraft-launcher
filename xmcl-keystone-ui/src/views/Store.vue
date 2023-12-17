<template>
  <div class="store visible-scroll relative flex flex-col items-center overflow-auto">
    <Transition
      name="slide-y-transition"
      mode="out-in"
      @after-enter="end"
      @leave="start"
    >
      <router-view
        class="flex flex-col"
      />
    </Transition>
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
