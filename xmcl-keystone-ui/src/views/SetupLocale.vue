<template>
  <v-list
    class="non-moveable"
    lines="three"
    style="background: transparent; width: 100%"
  >
    <v-list-item
      :title="t('setup.locale.description')"
    />
    <v-list-item :title="t('setup.locale.language')">
      <v-list-item-action>
        <v-select
          :model-value="value"
          variant="filled"
          style="max-width: 185px"
          hide-details
          :items="locales"
          @update:model-value="emit('input', $event)"
        />
      </v-list-item-action>
    </v-list-item>
  </v-list>
</template>
<script lang=ts setup>
import localMapping from '../../../assets/locales.json'

defineProps<{ value: string }>()

const emit = defineEmits(['input'])

const { t } = useI18n()
const locales = Object.entries(localMapping).map(([key, value]) => ({
  text: value,
  value: key,
}))
</script>
