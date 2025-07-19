<template>
  <v-list-item>
    <template #title>
      <v-list-item-title>
        <slot
          v-if="slots.title"
          name="title"
        />
        <template v-else>
          {{ title }}
        </template>
      </v-list-item-title>
    </template>

    <template
      v-if="description"
      #subtitle
    >
      {{ description }}
    </template>
    
    <template #append>
      <v-select
        v-model="model"
        variant="filled"
        item-title="text"
        style="max-width: 185px"
        hide-details
        :items="items"
      />
    </template>
  </v-list-item>
</template>
<script setup lang="ts">
import { useVModel } from '@vueuse/core'

const props = defineProps<{
  title?: string
  description?: string
  select: string
  items: Array<{ text: string; value: string }>
}>()
const emit = defineEmits<{
  (event: 'update:select', value: string): void
}>()

const slots = useSlots()

const model = useVModel(props, 'select', emit)
</script>
