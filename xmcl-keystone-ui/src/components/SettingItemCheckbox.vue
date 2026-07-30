<template>
  <SettingItem
    :description="description"
    class="setting-item-checkbox cursor-pointer"
    role="checkbox"
    :aria-checked="model"
    :aria-label="title"
    tabindex="0"
    @click="model = !model"
    @keydown="onKeydown"
  >
    <template #preaction>
      <v-checkbox
        v-bind="$attrs"
        :model-value="model"
        class="mr-2"
        hide-details
        readonly
        tabindex="-1"
        aria-hidden="true"
        inert
      />
    </template>
    <template #title>
      {{ title }}
      <slot />
    </template>
  </SettingItem>
</template>
<script setup lang="ts">
import SettingItem from './SettingItem.vue'

defineOptions({ inheritAttrs: false })

const model = defineModel<boolean>({ required: true })

defineProps<{
  title: string
  description?: string
}>()

// The row itself is the checkbox (role="checkbox"), so it must be operable by
// keyboard — Space/Enter toggle, matching native checkbox behaviour. Gamepad
// "A" activates it via the same click handler.
function onKeydown(e: KeyboardEvent) {
  if (e.key === ' ' || e.key === 'Enter') {
    e.preventDefault()
    model.value = !model.value
  }
}
</script>

<style scoped>
.setting-item-checkbox:hover {
  background-color: rgba(255, 255, 255, 0.04);
}
</style>
