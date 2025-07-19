<template>
  <v-list-item
    :disabled="disabled"
    @click="!disabled ? emit('input', !value) : undefined"
  >
    <template
      #prepend
    >
      <v-checkbox
        class="mr-6"
        hide-details
        :disabled="disabled"
        :readonly="true"
        :model-value="value"
        :value="value"
        @click.stop.prevent.capture="!disabled ? emit('input', !value) : undefined"
        @update:model-value="emit('input', !value)"
      />
    </template>
    
    <template #title>
      <v-list-item-title>
        {{ title }}
        <slot />
      </v-list-item-title>
    </template>
    
    <template
      v-if="description"
      #subtitle
    >
      <v-list-item-subtitle>
        {{ description }}
      </v-list-item-subtitle>
    </template>
    <template
      v-if="$slots.append"
      #append
    >
      <slot name="append" />
    </template>
  </v-list-item>
</template>
<script setup lang="ts">
import { useVModel } from '@vueuse/core'

const props = defineProps<{
  value: boolean
  title: string
  disabled?: boolean
  description?: string
}>()
const emit = defineEmits<{
  (event: 'input', value: boolean): void
}>()

const model = useVModel(props, 'value', emit)
</script>
