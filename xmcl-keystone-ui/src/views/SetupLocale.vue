<template>
  <v-list
    class="non-moveable"
    three-line
    subheader
    style="background: transparent; width: 100%"
  >
    <v-list-item>
      <v-list-item-content>
        <v-list-item-title class="flex-wrap whitespace-pre-wrap">
          {{ t('setup.locale.description') }}
        </v-list-item-title>
      </v-list-item-content>
    </v-list-item>
    <v-list-item>
      <v-list-item-content>
        <v-list-item-title>
          {{
            t("setup.locale.language")
          }}
        </v-list-item-title>
      </v-list-item-content>
      <v-list-item-action>
        <v-select
          :value="value"
          filled
          style="max-width: 185px"
          hide-details
          :items="locales"
          @input="emit('input', $event)"
        />
      </v-list-item-action>
    </v-list-item>
  </v-list>
</template>
<script lang=ts setup>
import localMapping from '@/assets/localeMapping.json'

defineProps<{ value: string }>()

const emit = defineEmits(['input'])

const { t } = useI18n()
const locales = [
  'en',
  'zh-CN',
  'ru',
].map(l => ({ text: (localMapping as any)[l] ?? l, value: l }))
</script>
