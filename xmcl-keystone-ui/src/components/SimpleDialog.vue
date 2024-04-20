<template>
  <v-dialog
    :value="value"
    :persistent="persistent"
    :width="width"
    @input="emit('input', $event)"
  >
    <v-card>
      <v-card-title
        class="headline"
        primary-title
      >
        {{ title }}
      </v-card-title>

      <v-card-text>
        <slot />
      </v-card-text>

      <v-divider />
      <v-card-actions>
        <v-btn
          text
          @click="onCancel"
        >
          {{ t('delete.no') }}
        </v-btn>
        <v-spacer />
        <v-btn
          :color="color ?? 'error'"
          text
          @click="onDelete"
        >
          <v-icon left>
            {{ confirmIcon ?? 'delete' }}
          </v-icon>
          {{ confirm ?? t('delete.yes') }}
        </v-btn>
      </v-card-actions>
    </v-card>
  </v-dialog>
</template>

<script lang="ts" setup>
const props = defineProps<{
  title: string
  width?: number
  color?: string
  confirm?: string
  confirmIcon?: string
  persistent?: boolean
  value?: boolean
}>()

const { t } = useI18n()

const emit = defineEmits(['confirm', 'cancel', 'input'])

const onDelete = () => {
  emit('confirm')
}

const onCancel = () => {
  emit('input', false)
  emit('cancel')
}

const onKeypress = (e: KeyboardEvent) => {
  if (e.key === 'Escape') {
    onCancel()
  }
}

onMounted(() => {
  document.addEventListener('keydown', onKeypress)
})
onUnmounted(() => {
  document.removeEventListener('keydown', onKeypress)
})

</script>
