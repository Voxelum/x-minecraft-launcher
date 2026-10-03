<template>
  <div class="flex flex-wrap items-center gap-2">
    <v-btn
      v-shared-tooltip="() => t('java.refresh')"
      data-testid="java-refresh"
      :aria-label="t('java.refresh')"
      icon
      variant="text"
      density="comfortable"
      size="small"
      :loading="refreshing"
      @click="refresh(true)"
    >
      <v-icon>refresh</v-icon>
    </v-btn>
    <v-btn
      id="java-import"
      data-testid="java-import"
      variant="tonal"
      size="small"
      :loading="importing"
      @click="browse"
    >
      <v-icon start size="small">add</v-icon>
      {{ t('java.importFromFile') }}
    </v-btn>
  </div>
</template>

<script setup lang="ts">
import { kJavaContext } from '@/composables/java'
import { useJavaImport } from '@/composables/javaImport'
import { useNotifier } from '@/composables/notifier'
import { vSharedTooltip } from '@/directives/sharedTooltip'
import { injection } from '@/util/inject'
import { getErrorMessage } from '@/util/error'

const emit = defineEmits<{ added: [] }>()
const { t } = useI18n()
const { notify } = useNotifier()
const { refresh, refreshing, refreshError } = injection(kJavaContext)
const { browse, importing, error } = useJavaImport(() => emit('added'))

watch(error, (message) => {
  if (message) notify({ level: 'error', title: t('java.importFromFile'), body: message })
})
watch(refreshError, (error) => {
  if (error) {
    notify({
      level: 'error',
      title: t('java.refresh'),
      body: getErrorMessage(error),
    })
  }
})
</script>
