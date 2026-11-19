<template>
  <div class="v-heading w-full select-none">
    <h3 class="xtext-h5">
      <span v-if="icon" class="heading-icon">
        <SettingIcon :icon="icon" :size="iconSize" color="primary" />
      </span>

      <span>{{ title }}</span>
    </h3>

    <v-list-subheader v-if="subtitle" class="p-0 h-[1.25rem]">
      {{ subtitle }}
    </v-list-subheader>
  </div>
</template>

<script setup lang="ts">
import SettingIcon from './SettingIcon.vue'

withDefaults(
  defineProps<{
    title: string
    icon?: string
    iconSize?: string | number
    subtitle?: string
  }>(),
  {
    iconSize: 30,
  },
)
</script>

<style scoped>
.v-heading {
  display: inline-block;
  padding: 0 0.25rem 0.5rem 0.1rem;
  z-index: 3;
}

.xtext-h5 {
  font-size: 1.25rem !important;
  display: flex;
  align-items: center;
  gap: 8px;
  letter-spacing: normal !important;
  text-transform: none !important;
}

.heading-icon {
  display: inline-flex;
  align-items: center;
  justify-content: center;
}
</style>
