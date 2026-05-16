<template>
  <div
    data-testid="setup-appearance"
    class="setup-step-content px-6 py-5"
  >
    <div class="text-lg font-semibold mb-1">{{ t('setup.appearance.name') }}</div>
    <v-list class="w-full pa-0" bg-color="transparent" lines="two">
      <v-list-item class="px-0">
        <v-list-item-title>
          {{ t('setting.darkTheme') }}
        </v-list-item-title>
        <v-list-item-subtitle>
          {{ t('setting.darkThemeDescription') }}
        </v-list-item-subtitle>
        <template #append>
          <v-select
            v-model="data.theme"
            variant="outlined"
            density="comfortable"
            item-title="text"
            style="min-width: 220px"
            hide-details
            :items="themes"
          />
        </template>
      </v-list-item>
    </v-list>
  </div>
</template>
<script lang="ts" setup>
import { kTheme } from '@/composables/theme'
import { injection } from '@/util/inject'

defineProps<{ modelValue: string }>()

const data = injection('setup' as any) as any
const { isDark } = injection(kTheme)

const themes = computed(() => [
  {
    text: t('setting.theme.dark'),
    value: 'dark',
  },
  {
    text: t('setting.theme.light'),
    value: 'light',
  },
  {
    text: t('setting.theme.system'),
    value: 'system',
  },
])

const emit = defineEmits(['update:modelValue'])

const { t } = useI18n()
</script>
