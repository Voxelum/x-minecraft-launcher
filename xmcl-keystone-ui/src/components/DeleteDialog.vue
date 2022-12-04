<template>
  <v-dialog
    v-model="isShown"
    :persistent="persistent"
    :width="width"
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
          color="primary"
          text
          @click="onCancel"
        >
          {{ t('delete.no') }}
        </v-btn>
        <v-spacer />
        <v-btn
          color="error"
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
import { useDialog } from '../composables/dialog'

const props = defineProps<{
  title: string
  width?: number
  confirm?: string
  confirmIcon?: string
  persistent?: boolean
  dialog?: string
}>()

const { isShown } = useDialog(props.dialog ?? 'deletion')
const { t } = useI18n()

const emit = defineEmits(['confirm', 'cancel'])

const onDelete = () => {
  emit('confirm')
  isShown.value = false
}

const onCancel = () => {
  emit('cancel')
  isShown.value = false
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
