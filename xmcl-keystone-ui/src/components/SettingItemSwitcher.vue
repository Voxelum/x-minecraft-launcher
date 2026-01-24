<template>
  <SettingItem :description="description" :title-class="titleClass">
    <template #title>
      <v-icon left small color="primary" v-if="icon">{{ icon }}</v-icon>
      {{ title }}
    </template>
    <template #action>
      <v-switch
        v-model="model"
        :disabled="disabled"
        color="primary"
        @click.stop.prevent.capture="!disabled ? emit('input', !value) : undefined"
      />
    </template>
  </SettingItem>
</template>
<script setup lang="ts">
import { useVModel } from "@vueuse/core";
import SettingItem from "./SettingItem.vue";

const props = defineProps<{
  value: boolean;
  title: string;
  icon?: string;
  disabled?: boolean;
  titleClass?: string;
  description?: string;
}>();
const emit = defineEmits<{
  (event: "input", value: boolean): void;
}>();

const model = useVModel(props, "value", emit);
</script>

<style scoped>
.v-list-item {
  background: transparent !important;
}

.v-list-item::before,
.v-list-item::after {
  opacity: 0 !important;
}

.v-list-item:hover::before {
  opacity: 0.04 !important;
}
</style>
