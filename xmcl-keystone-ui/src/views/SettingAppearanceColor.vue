<template>
  <v-menu
    :close-on-content-click="false"
    location="top"
  >
    <template #activator="{ props }">
      <div
        v-shared-tooltip="_ => text"
        class="color-button min-w-5 max-w-5 dark:border-light-50 rounded-full border-2 p-5 transition-all"
        :v-bind="props"
        :style="shadowColor"
      />
    </template>
    <v-card class="overflow-hidden">
      <v-color-picker
        :v-model="model"
        dot-size="25"
        show-swatches
        swatches-max-height="200"
      />
      <template v-if="hasBlur">
        <v-list-subheader>
          {{ t('setting.backdropBlur') }}
        </v-list-subheader>
        <v-slider
          v-model="blur"
          class="mx-2"
          :min="0"
          :max="30"
          density="compact"
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
  text: string
  hasBlur?: boolean
}>()

const model = defineModel<string>()
const blur = defineModel<number>('blur', { required: false })

const { t } = useI18n()

const { isDark } = injection(kTheme)

const shadowColor = computed(() => ({
  '--shadow-color': isDark.value ? '255 255 255' : '0 0 0',
  'background-color': model.value,
}))

</script>
<style scoped>

.color-button {
  box-shadow: 0 3px 5px -1px rgb(var(--shadow-color) / 20%), 0 5px 8px 0 rgb(var(--shadow-color) / 14%), 0 1px 14px 0 rgb(var(--shadow-color) / 12%);
}
.color-button:hover {
  box-shadow: 0 3px 5px -1px rgb(var(--shadow-color) / 20%), 0 5px 8px 0 rgb(var(--shadow-color) / 14%), 0 1px 14px 0 rgb(var(--shadow-color) / 12%);
}
.color-button:active {
  box-shadow: 0 8px 9px -5px rgb(var(--shadow-color) / 20%), 0 15px 22px 2px rgb(var(--shadow-color) / 14%), 0 6px 28px 5px rgb(var(--shadow-color) / 12%);
}

</style>
