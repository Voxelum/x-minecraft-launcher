<template>
  <v-menu
    :close-on-content-click="false"
    top
  >
    <template #activator="{ on, attrs }">
      <v-tooltip
        top
        v-on="on"
      >
        <template #activator="{ on: onTooltip }">
          <div
            class="color-button min-w-5 max-w-5 p-5 transition-all rounded-full border border-2 dark:border-light-50"
            v-bind="attrs"
            :style="shadowColor"
            @click="on.click($event)"
            v-on="onTooltip"
          />
        </template>
        {{ text }}
      </v-tooltip>
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
import { useTheme } from '@/composables'

const props = defineProps<{
  value: string
  text: string
}>()

const emit = defineEmits(['input'])

const { darkTheme } = useTheme()

const shadowColor = computed(() => ({
  '--shadow-color': darkTheme.value ? '255 255 255' : '0 0 0',
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
