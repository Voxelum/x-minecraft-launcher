<template>
  <v-menu
    :close-on-content-click="false"
    top
  >
    <template #activator="{ on, attrs }">
      <div
        v-shared-tooltip="_ => text"
        class="color-button min-w-5 max-w-5 dark:border-light-50 rounded-full border-2 p-5 transition-all"
        v-bind="attrs"
        :style="shadowColor"
        @click="on.click($event)"
      />
    </template>
    <v-color-picker
      :value="value"
      dot-size="25"
      show-swatches
      swatches-max-height="200"
      @input="emit('input', $event)"
    />
  </v-menu>
</template>
<script lang="ts" setup>
import { kTheme } from '@/composables/theme'
import { vSharedTooltip } from '@/directives/sharedTooltip'
import { injection } from '@/util/inject'

const props = defineProps<{
  value: string
  text: string
}>()

const emit = defineEmits(['input'])

const { isDark } = injection(kTheme)

const shadowColor = computed(() => ({
  '--shadow-color': isDark.value ? '255 255 255' : '0 0 0',
  'background-color': props.value,
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
