<template>
  <v-list-item>
    <v-list-item-content>
      <v-list-item-title>
        <slot
          v-if="slots.title"
          name="title"
        />
        <template v-else>
          {{ title }}
        </template>
      </v-list-item-title>
      <v-list-item-subtitle>
        {{ description }}
      </v-list-item-subtitle>
    </v-list-item-content>
    <v-list-item-action>
      <v-select
        v-model="model"
        filled
        style="max-width: 185px"
        hide-details
        :items="items"
      />
    </v-list-item-action>
  </v-list-item>
</template>
<script setup lang="ts">
import { useVModel } from '@vueuse/core'

const props = defineProps<{
  title: string
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
