<template>
  <v-menu
    :close-on-content-click="false"
    location="top"
  >
    <template #activator="{ props: activatorProps }">
      <div
        v-shared-tooltip="() => text"
        class="color-button min-w-6 max-w-6 rounded-full border-2 transition-all cursor-pointer"
        v-bind="activatorProps"
        :style="{ backgroundColor: modelValue }"
      />
    </template>
    <v-card class="overflow-hidden">
      <v-color-picker
        :model-value="modelValue"
        dot-size="25"
        show-swatches
        swatches-max-height="200"
        @update:model-value="emit('update:modelValue', $event)"
      />
      <template v-if="hasBlur">
        <v-list-subheader>
          {{ t('setting.backdropBlur') }}
        </v-list-subheader>
        <v-slider
          class="mx-2"
          :model-value="blur"
          :min="0"
          :max="30"
          density="compact"
          hide-details
          @update:model-value="emit('update:blur', $event)"
        />
      </template>
    </v-card>
  </v-menu>
</template>
<script lang="ts" setup>
import { kTheme } from '@/composables/theme'
import { vSharedTooltip } from '@/directives/sharedTooltip'
import { injection } from '@/util/inject'

const props = defineProps<{
  modelValue: string
  text: string
  blur?: number
  hasBlur?: boolean
}>()

const { t } = useI18n()
const emit = defineEmits<{
  (e: 'update:modelValue', value: string): void
  (e: 'update:blur', value: number): void
}>()

const { isDark } = injection(kTheme)

</script>
<style scoped>
.color-button {
  height: 24px;
  width: 24px;
  box-shadow: 0 4px 10px rgba(0, 0, 0, 0.35), inset 0 1px 1px rgba(255, 255, 255, 0.15);
  border-color: rgba(255, 255, 255, 0.25) !important;
}
.color-button:hover {
  transform: scale(1.2);
  box-shadow: 0 6px 16px rgba(0, 0, 0, 0.45), 0 0 12px rgba(var(--v-theme-primary), 0.5);
  border-color: rgba(var(--v-theme-primary), 0.6) !important;
}
.color-button:active {
  transform: scale(1.1);
  box-shadow: 0 2px 6px rgba(0, 0, 0, 0.5);
}
</style>
