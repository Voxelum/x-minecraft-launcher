<template>
  <div class="setup-step-content px-6 py-5">
    <div class="text-lg font-semibold mb-1">{{ t('setup.locale.name') }}</div>
    <p class="opacity-75 whitespace-pre-wrap mb-6">{{ t('setup.locale.description') }}</p>

    <v-list lines="two" bg-color="transparent" class="pa-0">
      <v-list-item class="px-0">
        <v-list-item-title>
          {{ t('setup.locale.language') }}
        </v-list-item-title>
        <template #append>
          <v-select
            data-testid="setup-locale-select"
            :model-value="modelValue"
            variant="outlined"
            density="comfortable"
            item-title="text"
            style="min-width: 220px"
            hide-details
            :items="locales"
            @update:model-value="emit('update:modelValue', $event)"
          />
        </template>
      </v-list-item>
    </v-list>
  </div>
</template>
<script lang="ts" setup>
import localMapping from '../../../assets/locales.json'

defineProps<{ modelValue: string }>()

const emit = defineEmits(['update:modelValue'])

const { t } = useI18n()
const locales = Object.entries(localMapping).map(([key, value]) => ({
  text: value,
  value: key,
}))
</script>
