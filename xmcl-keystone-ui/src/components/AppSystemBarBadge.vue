<template>
  <div
    class="non-moveable flex flex-grow-0 cursor-pointer rounded px-2 py-1 transition-all hover:bg-[rgba(255,255,255,0.2)]"
    @click="$emit('click', $event)"
  >
    <v-icon>
      {{ icon }}
    </v-icon>
    <span>
      {{ text }}
    </span>
  </div>
</template>
<script setup lang="ts">
defineProps<{
  icon: string
  text: string
}>()
</script>
