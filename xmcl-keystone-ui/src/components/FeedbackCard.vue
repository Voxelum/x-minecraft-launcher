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
