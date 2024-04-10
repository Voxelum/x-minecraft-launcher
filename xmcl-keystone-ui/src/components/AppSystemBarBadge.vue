<template>
  <div
    class="non-moveable flex flex-grow-0 cursor-pointer rounded px-2 py-1 transition-all hover:bg-[rgba(255,255,255,0.2)]"
    @click="$emit('click', $event)"
  >
    <v-icon class="badge-icon">
      {{ icon }}
    </v-icon>
    <span
      class="whitespace-nowrap"
      :class="{ 'badge-text': canHideText }"
    >
      {{ text }}
    </span>
  </div>
</template>
<script setup lang="ts">
defineProps<{
  icon: string
  text: string
  canHideText?: boolean
}>()

</script>
<style scoped>

@media (max-width: 880px) {
  .badge-text {
    display: none;
  }

  .badge-icon {
    margin-right: 0;
  }
}
</style>
