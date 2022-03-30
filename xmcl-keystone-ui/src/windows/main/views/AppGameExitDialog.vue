<template>
  <v-dialog
    v-model="isShown"
    :width="750"
    :persistent="true"
  >
    <v-toolbar color="error">
      <v-toolbar-title
        class="white--text"
      >
        {{ isCrash ? $t('launch.crash') : $t('launch.failed.title') }}
      </v-toolbar-title>
      <v-spacer />
      <v-toolbar-items>
        <v-btn
          text
          @click="openFolder"
        >
          {{ isCrash ? $t('launch.openCrashReportFolder') : $t('launch.openLogFolder') }}
        </v-btn>
      </v-toolbar-items>
      <v-btn
        icon
        @click="isShown=false"
      >
        <v-icon>arrow_drop_down</v-icon>
      </v-btn>
    </v-toolbar>
    <v-card class="overflow-auto max-h-200">
      <v-card-text>
        <div
          style="padding: 10px"
        >
          {{ isCrash ? $t(`launch.crash`) : $t(`launch.failed.description`) }}
        </div>
        <pre class="rounded p-5 bg-[rgba(0,0,0,0.1)] hover:bg-[rgba(0,0,0,0.2)] overflow-auto">
          {{ errorLog }}
        </pre>
        <div
          style="padding: 10px"
        >
          {{ $t(`launch.failed.latest`) }}
        </div>
        <pre class="rounded p-5 bg-[rgba(0,0,0,0.1)] hover:bg-[rgba(0,0,0,0.2)] overflow-auto">
          {{ log }}
        </pre>
      </v-card-text>
    </v-card>
  </v-dialog>
</template>

<script lang=ts>
import { reactive, toRefs, defineComponent } from '@vue/composition-api'
import { useService } from '/@/composables'
import { BaseServiceKey, InstanceLogServiceKey, LaunchServiceKey } from '@xmcl/runtime-api'

export default defineComponent({
  setup() {
    const data = reactive({
      isShown: false,
      log: '',
      isCrash: false,
      crashReportLocation: '',
      errorLog: '',
    })
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
      const log = await getLogContent('latest.log')
      data.log = decorate(log)
      data.isShown = true
    }
    async function displayCrash() {
      const log = await getCrashReportContent(data.crashReportLocation)
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
    return {
      ...toRefs(data),
      openFolder() {
        if (data.isCrash) {
          showItemInDirectory(data.crashReportLocation)
        } else {
          showLog('latest.log')
        }
      },
    }
  },
})
</script>

<style>
</style>
