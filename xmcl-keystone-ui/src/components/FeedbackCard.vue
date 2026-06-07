<template>
  <div class="feedback-card flex flex-col gap-4">
    <div
      v-if="icon"
      class="surface-panel p-4"
    >
      <div class="flex items-center">
        <v-icon
          color="primary"
          class="mr-2"
        >
          info
        </v-icon>
        <span class="text-h6">{{ t('feedback.hint') }}</span>
      </div>
    </div>

    <div
      v-else
      class="text-body-2 text--secondary"
    >
      {{ t('feedback.hint') }}
    </div>

    <div class="flex w-full">
      <v-btn
        class="flex-grow"
        rounded="pill"
        color="primary"
        :loading="loading"
        size="large"
        variant="flat"
        @click="generateReport"
      >
        <v-icon
          v-if="!done"
          start
        >
          bug_report
        </v-icon>
        <v-icon
          v-else
          start
        >
          check_circle
        </v-icon>
        {{ t('feedback.generateReport') }}
      </v-btn>
    </div>
  </div>
</template>

<script lang="ts" setup>
import { BaseServiceKey } from '@xmcl/runtime-api'
import { useRefreshable, useService } from '@/composables'

withDefaults(defineProps<{ icon?: boolean; border?: string }>(), { icon: true, border: 'left' })

const { t } = useI18n()
const { reportItNow } = useService(BaseServiceKey)
const done = ref(false)

const { refresh: generateReport, refreshing: loading } = useRefreshable(async () => {
  const { filePath } = await windowController.showSaveDialog({
    title: t('feedback.generateSaveAs'),
    defaultPath: 'report.zip',
  })
  if (filePath) {
    await reportItNow({ destination: filePath })
    done.value = true
  }
})
</script>

<style scoped>
.feedback-card {
  width: 100%;
}
</style>
