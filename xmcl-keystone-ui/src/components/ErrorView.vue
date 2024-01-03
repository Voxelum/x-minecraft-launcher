<template>
  <div
    v-if="!!error"
    class="flex flex-col items-center gap-4 px-5 py-10"
  >
    <v-icon
      color="error"
      size="100"
    >
      error
    </v-icon>
    <div class="max-w-full select-text overflow-auto break-words text-center text-3xl font-bold">
      {{ tError(error) }}
    </div>
    <div
      v-if="error.stack"
      class="max-w-full overflow-x-auto rounded dark:bg-gray-900"
    >
      <pre>
        {{ error.stack.trim() }}
      </pre>
    </div>
    <v-btn
      v-if="!noRefresh"
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
defineProps<{
  error: any
  noRefresh?: boolean
}>()
const emit = defineEmits(['refresh'])
const { t } = useI18n()
</script>
