<template>
  <v-list-item
    :disabled="disabled"
    @click="!disabled ? (model = !model) : undefined"
  >
    <template
      #prepend
    >
      <v-checkbox
        class="mr-6"
        hide-details
        :disabled="disabled"
        :readonly="true"
        :model-value="model"
        @click.stop.prevent.capture="!disabled ? (model = !model) : undefined"
        @update:model-value="(model = !model)"
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
defineProps<{
  title: string
  disabled?: boolean
  description?: string
}>()

const model = defineModel<boolean>({
  required: false,
})
</script>
