<template>
  <div>
    <v-alert
      class="mx-4"
      :border="border"
      colored-border
      outlined
      :type="icon ? 'info' : undefined"
    >
      {{ t('feedback.hint') }}
    </v-alert>

    <div class="flex w-full">
      <v-btn
        class="mx-4 flex-grow"
        shaped
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
          done
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

<i18n locale="en" lang="yaml">
feedback:
  hint: Click the button to create the report and contact the developer team. The report will contains your device info including operating system type, version, user name (in your os), etc.
  generateSaveAs: Save the report to
  generateReport: Generate Report
</i18n>

<i18n locale="zh-CN" lang="yaml">
feedback:
  hint: 点击生成报告按钮并联系开发团队。这个报告会包含你的设备信息，如操作系统，版本，操作系统的用户名等。
  generateSaveAs: 将报告保存在
  generateReport: 生成报告
</i18n>
