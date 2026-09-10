<template>
  <div class="feedback-card flex flex-col gap-4 w-full">
    <div v-if="icon" class="surface-panel p-4 flex items-center">
      <v-icon color="primary" class="mr-2">info</v-icon>
      <span class="text-h6">{{ t('feedback.hint') }}</span>
    </div>
    <div v-else class="text-body-2 text--secondary">
      {{ t('feedback.hint') }}
    </div>

    <div
      class="surface-panel flex items-center justify-between p-3 rounded-xl cursor-pointer"
      @click="anonymizeIp = !anonymizeIp"
    >
      <div class="flex items-center gap-3 min-w-0 flex-1 mr-2">
        <v-icon :color="anonymizeIp ? 'primary' : undefined" size="20">security</v-icon>
        <div class="flex flex-col min-w-0">
          <span class="text-xs font-semibold">{{ t('feedback.anonymizeIp') }}</span>
          <span class="text-[11px] opacity-60">{{ t('feedback.anonymizeIpHint') }}</span>
        </div>
      </div>
      <v-switch v-model="anonymizeIp" color="primary" hide-details density="compact" class="flex-shrink-0" @click.stop />
    </div>

    <div class="flex w-full gap-2">
      <v-btn class="flex-1" rounded="pill" variant="tonal" color="primary" :loading="previewLoading" size="large" @click="openPreview">
        <v-icon start>visibility</v-icon>
        {{ t('feedback.previewReport') }}
      </v-btn>
      <v-btn class="flex-1" rounded="pill" color="primary" :loading="loading" size="large" variant="flat" @click="generateReport">
        <v-icon start>{{ done ? 'check_circle' : 'bug_report' }}</v-icon>
        {{ t('feedback.generateReport') }}
      </v-btn>
    </div>

    <div class="flex items-center justify-end">
      <v-btn variant="text" size="small" color="error" prepend-icon="delete_sweep" :loading="clearing" @click="onClear">
        {{ t('feedback.clearLogs') }}
      </v-btn>
    </div>

    <FeedbackReportPreviewDialog v-model="previewShown" :report="previewData" :anonymized="anonymizeIp" @cleared="refreshPreview" />
  </div>
</template>

<script lang="ts" setup>
import { BaseServiceKey, ReportPreview } from '@xmcl/runtime-api'
import { useRefreshable, useService } from '@/composables'
import { useNotifier } from '@/composables/notifier'
import FeedbackReportPreviewDialog from './FeedbackReportPreviewDialog.vue'

withDefaults(defineProps<{ icon?: boolean }>(), { icon: true })

const { t } = useI18n()
const { notify } = useNotifier()
const { reportItNow, getReportPreview, clearLogs } = useService(BaseServiceKey)
const done = ref(false)
const anonymizeIp = ref(true)
const previewShown = ref(false)
const previewData = ref<ReportPreview | null>(null)
const clearing = ref(false)

const refreshPreview = async () => { previewData.value = await getReportPreview({ anonymizeIp: anonymizeIp.value }) }

const { refresh: openPreview, refreshing: previewLoading } = useRefreshable(async () => {
  await refreshPreview()
  previewShown.value = true
})

const { refresh: generateReport, refreshing: loading } = useRefreshable(async () => {
  const { filePath } = await windowController.showSaveDialog({ title: t('feedback.generateSaveAs'), defaultPath: 'report.zip' })
  if (filePath) {
    await reportItNow({ destination: filePath, anonymizeIp: anonymizeIp.value })
    done.value = true
  }
})

async function onClear() {
  clearing.value = true
  try {
    await clearLogs()
    await refreshPreview()
    notify({ level: 'success', title: t('feedback.logsCleared') })
  } finally {
    clearing.value = false
  }
}
</script>
