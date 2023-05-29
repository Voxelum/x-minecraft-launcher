<template>
  <v-dialog
    v-model="data.isShown"
    :width="750"
    :persistent="true"
  >
    <v-card class="overflow-auto visible-scroll flex flex-col max-h-[80vh]">
      <v-toolbar color="error">
        <v-toolbar-title
          class="white--text"
        >
          {{ data.isCrash ? t('launchFailed.crash') : t('launchFailed.title') }}
        </v-toolbar-title>
        <v-spacer />
        <v-toolbar-items>
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
      <v-card-text class="overflow-auto flex flex-col">
        <div
          style="padding: 10px"
        >
          {{ data.isCrash ? t(`launchFailed.crash`) : t(`launchFailed.description`) }}
        </div>
        <pre class="rounded p-5 bg-[rgba(0,0,0,0.1)] hover:bg-[rgba(0,0,0,0.2)] overflow-auto">{{ data.errorLog }}</pre>
        <div
          style="padding: 10px"
        >
          {{ t(`launchFailed.latestLog`) }}
        </div>
        <pre class="rounded p-5 bg-[rgba(0,0,0,0.1)] hover:bg-[rgba(0,0,0,0.2)] overflow-auto">{{ data.log }}</pre>
      </v-card-text>
    </v-card>
  </v-dialog>
</template>

<script lang=ts setup>
import { useService } from '@/composables'
import { kInstance } from '@/composables/instance'
import { injection } from '@/util/inject'
import { BaseServiceKey, InstanceLogServiceKey, LaunchServiceKey } from '@xmcl/runtime-api'

const data = reactive({
  isShown: false,
  log: '',
  isCrash: false,
  crashReportLocation: '',
  errorLog: '',
})
const { t } = useI18n()
const { path } = injection(kInstance)
const { getLogContent, getCrashReportContent, showLog } = useService(InstanceLogServiceKey)
const { on } = useService(LaunchServiceKey)
const { showItemInDirectory } = useService(BaseServiceKey)
function decorate(log: string) {
  // let lines = log.split('\n');
  // let result: string[] = [];
  // for (let i = 0; i < lines.length; i++) {
  //   result.push(lines[i].trim(), ' ');
  // }
  // return result.join('\n');
  return log
}
async function displayLog() {
  const log = await getLogContent(path.value, 'latest.log')
  data.log = decorate(log)
  data.isShown = true
}
async function displayCrash() {
  const log = await getCrashReportContent(path.value, data.crashReportLocation)
  data.log = decorate(log)
  data.isShown = true
}
on('minecraft-exit', ({ code, signal, crashReport, crashReportLocation, errorLog }) => {
  if (code !== 0) {
    console.log(errorLog)
    data.errorLog = errorLog
    if (crashReportLocation) {
      data.crashReportLocation = crashReportLocation
      data.isCrash = true
      displayCrash()
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
</script>

<style>
</style>
