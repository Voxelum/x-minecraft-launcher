<template>
  <SettingItem :title="title" :description="description" :search-query="searchQuery" :search-keywords="items.map(i => i.text)">
    <template #title>
      <slot v-if="slots.title" name="title" />
      <template v-else>
        <v-icon v-if="icon" start size="small" color="primary">{{ icon }}</v-icon>
        {{ title }}
      </template>
    </template>
    <template #action="{ titleId, descriptionId }">
      <v-select
        :model-value="localModel"
        @update:model-value="onChange"
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
import { useSlots, ref, watch } from 'vue'
import SettingItem from './SettingItem.vue'

defineOptions({ inheritAttrs: false })

const props = defineProps<{
  modelValue?: any
  title: string
  description?: string
  icon?: string
  items: Array<any>
  searchQuery?: string
}>()

const emit = defineEmits(['update:modelValue'])

const localModel = ref(props.modelValue)

watch(() => props.modelValue, (newVal) => {
  localModel.value = newVal
})

function onChange(val: any) {
  localModel.value = val
  emit('update:modelValue', val)
}

const slots = useSlots()
</script>

<style scoped>
.setting-item-select {
  min-width: 200px;
  max-width: 300px;
}
</style>
