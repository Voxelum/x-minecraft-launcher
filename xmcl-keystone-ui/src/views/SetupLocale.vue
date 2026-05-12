<template>
  <v-list class="non-moveable" three-line subheader style="background: transparent; width: 100%">
    <v-list-item>
      <v-list-item-title class="flex-wrap whitespace-pre-wrap">
        {{ t('setup.locale.description') }}
      </v-list-item-title>
    </v-list-item>
    <v-list-item>
      <v-list-item-title>
        {{ t('setup.locale.language') }}
      </v-list-item-title>
      <v-list-item-action>
        <v-select
          data-testid="setup-locale-select"
          :model-value="modelValue"
          filled
          item-title="text"
          style="max-width: 185px"
          hide-details
          :items="locales"
          @update:model-value="emit('update:modelValue', $event)"
        />
      </v-list-item-action>
    </v-list-item>
  </v-list>
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
