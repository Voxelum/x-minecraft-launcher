<template>
  <div class="m-8 flex flex-col items-center justify-center">
    <div class="relative mt-8">
      <v-progress-circular
        color="primary"
        :size="70"
        :width="4"
        indeterminate
      />

      <v-progress-circular
        class="absolute left-[10px] top-[11px]"
        color="error"
        :size="50"
        :width="4"
        indeterminate
      />

      <v-progress-circular
        class="absolute left-[20px] top-[21px]"
        color="warning"
        :size="30"
        :width="4"
        indeterminate
      />
    </div>
    <slot />
  </div>
</template>
<script setup lang="ts">
defineProps<{
  texts: (string| number)[]
  hint?: string
  secondaryHint?: boolean
}>()
</script>
