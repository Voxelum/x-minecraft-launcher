<template>
  <v-dialog
    v-model="data.isShown"
    :persistent="true"
  >
    <v-card class="visible-scroll flex max-h-[80vh] flex-col overflow-auto">
      <v-toolbar color="error">
        <v-toolbar-title
          class="white--text"
        >
          {{ data.isCrash ? t('launchFailed.crash') : t('launchFailed.title') }}
        </v-toolbar-title>
        <v-spacer />
        <v-toolbar-items v-if="!data.launcherError">
          <v-btn
            text
            @click="openFolder"
          >
            {{ data.isCrash ? t('instance.openCrashReportFolder') : t('instance.openLogFolder') }}
          </v-btn>
        </v-toolbar-items>
        <v-btn
          icon
          @click="data.isShown=false"
        >
          <v-icon>arrow_drop_down</v-icon>
        </v-btn>
      </v-toolbar>
      <v-card-text class="grid grid-cols-12 overflow-auto gap-4">
        <div class="col-span-9 flex flex-col overflow-auto mt-4">
          <div
            v-if="data.errorLog"
          >
            {{ data.launcherError ? t('launchFailed.failedToLaunch') : data.isCrash ? t(`launchFailed.crash`) : t(`launchFailed.description`) }}
          </div>
          <pre
            v-if="data.errorLog"
            class="overflow-auto min-h-[200px] rounded bg-[rgba(0,0,0,0.1)] p-5 hover:bg-[rgba(0,0,0,0.2)]"
          >{{ data.errorLog }}</pre>
          <div
            v-if="!data.isCrash"
          >
            {{ t(`launchFailed.latestLog`) }}
          </div>
          <pre class="overflow-auto rounded bg-[rgba(0,0,0,0.1)] p-5 hover:bg-[rgba(0,0,0,0.2)]">{{ data.log }}</pre>
        </div>
        <AppCrashAIHint
          class="col-span-3 mt-2"
          :useCNAI="useCNAI"
          :getPrompt="getPrompt"
        />
      </v-card-text>
    </v-card>
  </v-dialog>
</template>

<script lang=ts setup>
import AppCrashAIHint from '@/components/AppCrashAIHint.vue'
import { useService } from '@/composables'
import { kEnvironment } from '@/composables/environment'
import { kInstance } from '@/composables/instance'
import { kInstanceLaunch } from '@/composables/instanceLaunch'
import { kSettingsState } from '@/composables/setting'
import { getCrashPrompt } from '@/util/crashPrompt'
import { injection } from '@/util/inject'
import { BaseServiceKey, InstanceLogServiceKey, LaunchServiceKey } from '@xmcl/runtime-api'

const data = reactive({
  isShown: false,
  log: '',
  isCrash: false,
  launcherError: false,
  crashReportLocation: '',
  errorLog: '',
})
watch(() => data.isShown, (isShown) => {
  if (!isShown) {
    data.log = ''
    data.isCrash = false
    data.launcherError = false
    data.crashReportLocation = ''
    data.errorLog = ''
  }
})
const { t } = useI18n()
const { path } = injection(kInstance)
const { getLogContent, getCrashReportContent, showLog } = useService(InstanceLogServiceKey)
const { on } = useService(LaunchServiceKey)
const { showItemInDirectory } = useService(BaseServiceKey)
const { error } = injection(kInstanceLaunch)

watch(error, (e) => {
  if (!e) return
  data.launcherError = true
  data.errorLog = JSON.stringify(e, null, 2)
})
async function displayLog() {
  const log = await getLogContent(path.value, 'latest.log')
  data.log = log
  data.isShown = true
}
async function displayCrash(crashReport: string | undefined) {
  const log = await getCrashReportContent(path.value, data.crashReportLocation) || crashReport || ''
  data.log = log
  data.isShown = true
}
on('minecraft-exit', ({ code, signal, crashReport, crashReportLocation, errorLog, stdLog }) => {
  if (!code && signal === 'SIGTERM') {
    return
  }
  if (code !== 0) {
    data.errorLog = (errorLog || '' + '\n' + (stdLog || '')).trim()
    if (crashReportLocation) {
      data.crashReportLocation = crashReportLocation
      data.isCrash = true
      displayCrash(crashReport)
    } else {
      displayLog()
    }
  }
})
function openFolder() {
  if (data.isCrash) {
    showItemInDirectory(data.crashReportLocation)
  } else {
    showLog(path.value, 'latest.log')
  }
}

const env = injection(kEnvironment)
const useCNAI = computed(() => {
  return env.value?.gfw || env.value?.region === 'zh-CN'
})

const { state } = injection(kSettingsState)
function getPrompt(raw?: boolean) {
  if (raw) {
    return data.errorLog
  }
  return getCrashPrompt(useCNAI.value, data.log, data.errorLog, state.value?.locale || 'en-US')
}
</script>

<style>
</style>
