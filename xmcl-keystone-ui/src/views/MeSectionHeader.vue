<template>
  <div class="flex items-center gap-3">
    <h2
      v-if="!options"
      class="text-align-left"
    >
      {{ title }}
    </h2>
    <v-menu
      v-else
      offset-y
      open-on-hover
    >
      <template #activator="{ props }">
        <h2
          class="text-align-left cursor-pointer"
          v-bind="props"
        >
          {{ title }}
          <v-icon>
            keyboard_arrow_down
          </v-icon>
        </h2>
      </template>
      <v-list density="compact">
        <v-list-item
          v-for="o of options"
          :key="o.value"
          :prepend-icon="o.icon"
          :title="o.text"
          @click="$emit('select', o.value)"
        />
      </v-list>
    </v-menu>
    <v-divider
      :class="{ 'mr-2' : !slots.extra }"
    />
    <slot name="extra" />
    <!-- <v-menu>
      <template #activator="{ on }">
        <v-btn
          icon
          v-on="on"
        >
          <v-icon>
            settings
          </v-icon>
        </v-btn>
      </template>
      <slot />
    </v-menu> -->
  </div>
</template>
<script setup lang="ts">
defineProps<{
  title: string
  options?: Array<{ text: string; value: string; icon?: string }>
}>()
const slots = useSlots()
defineEmits(['select'])
</script>
<style scoped>
h2 {
  @apply mt-2 mb-2 ml-3 text-lg;
  letter-spacing: 1px;
}
</style>
