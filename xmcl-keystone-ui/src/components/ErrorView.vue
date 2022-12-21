<template>
  <div
    v-if="!!error"
    class="flex flex-col items-center gap-4 my-10"
  >
    <v-icon
      color="error"
      size="100"
    >
      error
    </v-icon>
    <div class="text-3xl font-bold">
      {{ tError(error) }}
    </div>
    <v-btn
      color="error"
      @click="emit('refresh')"
    >
      {{ t('refresh') }}
    </v-btn>
  </div>
</template>
<script lang="ts" setup>
import { useLocaleError } from '@/composables/error'

const tError = useLocaleError()
defineProps<{ error: any }>()
const emit = defineEmits(['refresh'])
const { t } = useI18n()
</script>
