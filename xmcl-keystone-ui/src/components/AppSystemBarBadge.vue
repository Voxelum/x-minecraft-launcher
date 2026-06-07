<template>
  <button
    type="button"
    class="system-bar-badge non-moveable flex flex-grow-0 cursor-pointer items-center rounded px-2 py-1 transition-all"
    :aria-label="ariaLabel || text || undefined"
    @click="$emit('click', $event)"
  >
    <v-icon
      v-if="icon"
      size="22"
      :start="!!text"
      class="badge-icon"
      aria-hidden="true"
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
    <slot name="append" />
  </button>
</template>
<script setup lang="ts">
defineProps<{
  icon?: string
  text?: string
  canHideText?: boolean
  ariaLabel?: string
}>()

</script>
<style scoped>
.system-bar-badge {
  background: transparent;
  border: 0;
  color: inherit;
  font: inherit;
  appearance: none;
}

.system-bar-badge:hover {
  background: rgba(255, 255, 255, 0.2);
}

.system-bar-badge:focus-visible {
  outline: 2px solid rgba(255, 255, 255, 0.7);
  outline-offset: 1px;
}

@media (max-width: 880px) {
  .badge-text {
    display: none;
  }

  .badge-icon {
    margin-right: 0;
  }
}
</style>
