<template>
  <v-list-item>
    <v-list-item-action
      v-if="slots.preaction"
      class="self-center"
    >
      <slot
        name="preaction"
      />
    </v-list-item-action>
    
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
    
    <v-list-item-action>
      <slot name="action" />
    </v-list-item-action>
  </v-list-item>
</template>
<script setup lang="ts">

const props = defineProps<{
  title?: string
  description?: string
}>()

const slots = useSlots()
</script>
