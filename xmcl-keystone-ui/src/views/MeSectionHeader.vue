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
      <template #activator="{ on }">
        <h2
          class="text-align-left cursor-pointer"
          v-on="on"
        >
          {{ title }}
          <v-icon>
            keyboard_arrow_down
          </v-icon>
        </h2>
      </template>
      <v-list dense>
        <v-list-item
          v-for="o of options"
          :key="o.value"
          @click="$emit('select', o.value)"
        >
          <v-list-item-icon>
            <v-icon v-text="o.icon" />
          </v-list-item-icon>
          <v-list-item-content>
            <v-list-item-title>
              {{ o.text }}
            </v-list-item-title>
          </v-list-item-content>
        </v-list-item>
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
