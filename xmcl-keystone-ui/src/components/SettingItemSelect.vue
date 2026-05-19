<template>
  <SettingItem :description="description">
    <template #title>
      <slot v-if="slots.title" name="title" />
      <template v-else>
        <v-icon v-if="icon" start size="small" color="primary">{{ icon }}</v-icon>
        {{ title }}
      </template>
    </template>
    <template #action="{ titleId, descriptionId }">
      <v-select
        v-model="model"
        v-bind="$attrs"
        variant="outlined"
        density="compact"
        item-title="text"
        item-value="value"
        class="setting-item-select font-weight-medium"
        hide-details
        :items="items"
        :aria-labelledby="titleId"
        :aria-describedby="description ? descriptionId : undefined"
      />
    </template>
  </SettingItem>
</template>
<script setup lang="ts">
import SettingItem from './SettingItem.vue'

defineOptions({ inheritAttrs: false })

const model = defineModel<string>({ required: true })

defineProps<{
  title: string
  description?: string
  icon?: string
  items: Array<{ text: string; value: string }>
}>()

const slots = useSlots()
</script>

<style scoped>
.setting-item-select {
  min-width: 200px;
  max-width: 300px;
}
</style>
