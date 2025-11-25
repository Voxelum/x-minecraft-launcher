<template>
  <div class="feedback-card">
    <v-card
      class="mx-4 mb-4"
      elevation="2"
      outlined
    >
      <v-card-text class="pa-4">
        <div class="d-flex align-center mb-3">
          <v-icon
            v-if="icon"
            color="primary"
            class="mr-2"
          >
            info
          </v-icon>
          <span class="text-h6">{{ t('feedback.hint') }}</span>
        </div>
      </v-card-text>
    </v-card>

    <div class="flex w-full px-4">
      <v-btn
        class="flex-grow"
        rounded
        large
        depressed
        color="primary"
        :loading="loading"
        @click="generateReport"
      >
        <v-icon
          v-if="!done"
          left
        >
          bug_report
        </v-icon>
        <v-icon
          v-else
          left
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
  margin-bottom: 16px;
}
</style>
