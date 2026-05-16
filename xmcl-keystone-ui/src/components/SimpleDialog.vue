<template>
  <v-dialog
    :model-value="shown"
    :persistent="persistent"
    :width="width"
    @update:model-value="onModelUpdate"
  >
    <v-card :title="title">
      <v-card-text
        class="select-none"
      >
        <slot />
      </v-card-text>

      <v-divider />
      <v-card-actions>
        <v-btn
          @click="onCancel"
         variant="text">
          {{ t('delete.no') }}
        </v-btn>
        <v-spacer />
        <v-btn
          :color="color ?? 'error'"
          @click="onConfirm"
         variant="text">
          <v-icon start>
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
  modelValue?: boolean
}>()

const { t } = useI18n()

const emit = defineEmits<{
  (event: 'confirm'): void
  (event: 'cancel'): void
  (event: 'input', value: boolean): void
  (event: 'update:modelValue', value: boolean): void
}>()

const shown = computed(() => props.modelValue ?? props.value ?? false)

function onModelUpdate(value: boolean) {
  emit('input', value)
  emit('update:modelValue', value)
}

const onConfirm = () => {
  emit('confirm')
}

const onCancel = () => {
  onModelUpdate(false)
  emit('cancel')
}

const onKeypress = (e: KeyboardEvent) => {
  if (e.key === 'Escape' && shown.value) {
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
