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
          {{ $t('delete.no') }}
        </v-btn>
        <v-spacer />
        <v-btn
          color="red"
          text
          @click="onDelete"
        >
          <v-icon left>
            delete
          </v-icon>
          {{ $t('delete.yes') }}
        </v-btn>
      </v-card-actions>
    </v-card>
  </v-dialog>
</template>

<script lang="ts" setup>
import { useDialog } from '../composables/dialog'

const { isShown } = useDialog('deletion')

defineProps<{
  title: string
  width?: number
  persistent?: boolean
}>()

const emit = defineEmits(['confirm', 'cancel'])

const onDelete = () => {
  emit('confirm')
  isShown.value = false
}

const onCancel = () => {
  emit('cancel')
  isShown.value = false
}

</script>
