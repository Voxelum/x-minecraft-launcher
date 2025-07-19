<template>
  <div
    class="non-moveable flex flex-grow-0 cursor-pointer items-center rounded px-2 py-1 transition-all hover:bg-[rgba(255,255,255,0.2)]"
    @click="$emit('click', $event)"
  >
    <v-icon
      v-if="icon"
      size="22"
      :start="!!text"
      class="badge-icon"
    >
      {{ icon }}
    </v-icon>
    <template v-else>
      <slot
        class="badge-icon"
      />
    </template>
    <span
      v-if="text"
      class="whitespace-nowrap"
      :class="{ 'badge-text': canHideText }"
    >
      {{ text }}
    </span>
  </div>
</template>
<script setup lang="ts">
defineProps<{
  icon?: string
  text?: string
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
