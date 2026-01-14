<template>
  <div
    class="v-heading w-full select-none"
  >
    <h3 class="xtext-h5">
      <v-icon color="primary" left v-if="icon">{{ icon }}</v-icon>
      {{ title }}
    </h3>
    <v-subheader v-if="subtitle" class="p-0 h-[1.25rem]">
      {{ subtitle }}
    </v-subheader>
  </div>
</template>
<script setup lang="ts">
defineProps<{
  title: string
  icon?: string
  subtitle?: string
}>()
</script>
<style scoped>
  .v-heading {
    display: inline-block;
    top: 0;
    padding: 0 .25rem .5rem 0.1rem;
    z-index: 3;
  }
  .xtext-h5 {
    font-size: 1.25rem !important;
    display: flex;
    /* font-weight: 400;
    line-height: 1.8rem; */
    letter-spacing: normal !important;
    text-transform: none !important;
  }
</style>
