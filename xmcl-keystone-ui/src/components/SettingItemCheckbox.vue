<template>
  <SettingItem
    :title="title"
    :description="description"
    :search-query="searchQuery"
    class="setting-item-checkbox cursor-pointer"
    @click="model = !model"
  >
    <template #preaction="{ titleId, descriptionId }">
      <v-checkbox
        v-bind="$attrs"
        :model-value="model"
        class="mr-2"
        hide-details
        readonly
        :aria-labelledby="titleId"
        :aria-describedby="description ? descriptionId : undefined"
      />
    </template>
    <template #title v-if="$slots.default">
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
  searchQuery?: string
}>()
</script>

<style scoped>
.setting-item-checkbox:hover {
  background-color: rgba(255, 255, 255, 0.04);
}
</style>
