<template>
  <SettingItem :description="description" :title-class="titleClass">
    <template #title>
      <v-icon v-if="icon" start size="small" color="primary">{{ icon }}</v-icon>
      {{ title }}
    </template>
    <template #action="{ titleId, descriptionId }">
      <v-switch
        v-model="model"
        v-bind="$attrs"
        color="primary"
        hide-details
        :aria-labelledby="titleId"
        :aria-describedby="description ? descriptionId : undefined"
      />
    </template>
  </SettingItem>
</template>
<script setup lang="ts">
import SettingItem from "./SettingItem.vue";

defineOptions({ inheritAttrs: false });

const model = defineModel<boolean>({ required: true });

defineProps<{
  title: string;
  icon?: string;
  titleClass?: string;
  description?: string;
}>();
</script>

<style scoped>
.setting-item-switcher :deep(.setting-item__action .v-switch) {
  flex: none;
}
</style>
