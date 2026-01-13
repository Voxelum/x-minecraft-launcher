<template>
  <v-list-item class="select-none">
    <v-list-item-action
      class="self-center"
      v-if="slots.preaction"
    >
      <slot
        name="preaction"
      />
    </v-list-item-action>
    <v-list-item-content>
      <v-list-item-title :class="titleClass" class="flex font-weight-medium">
        <slot
          v-if="slots.title"
          name="title"
        />
        <template v-else>
          {{ title }}
        </template>
      </v-list-item-title>
      <v-list-item-subtitle>
        <slot
          v-if="slots.subtitle"
          name="subtitle"
        />
        <template v-else>
          {{ description }}
        </template>
      </v-list-item-subtitle>
    </v-list-item-content>
    <v-list-item-action :style="longAction ? 'width: 50%' : ''">
      <slot name="action" />
    </v-list-item-action>
  </v-list-item>
</template>
<script setup lang="ts">

const props = defineProps<{
  title?: string
  description?: string
  titleClass?: string
  longAction?: boolean
}>()

const slots = useSlots()
</script>
