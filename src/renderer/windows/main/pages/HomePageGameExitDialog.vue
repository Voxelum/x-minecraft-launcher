<template>
  <v-dialog
    v-model="isShown"
    :width="550"
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
          flat
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
    <v-card style="overflow: auto; max-height: 450px;">
      <v-card-text>
        <div
          style="padding: 10px"
        >
          {{ isCrash ? $t(`launch.crash`) : $t(`launch.failed.description`) }}
        </div>
        <p>
          {{ errorLog }}
        </p>
        <v-textarea
          auto-grow
          autofocus
          box
          readonly
          hide-details
          :value="errorLog"
          style="margin: 8px; line-height: 30px;"
        />
        <div
          style="padding: 10px"
        >
          {{ $t(`launch.failed.latest`) }}
        </div>
        <v-textarea
          auto-grow
          autofocus
          box
          readonly
          hide-details
          :value="log"
          style="margin: 8px; line-height: 30px"
        />
      </v-card-text>
    </v-card>
  </v-dialog>
</template>

<script lang=ts>
import { reactive, toRefs, defineComponent } from '@vue/composition-api'
import { useIpc, useInstanceLogs, useService } from '/@/hooks'
import { BaseServiceKey } from '/@shared/services/BaseService'

export default defineComponent({
  setup() {
    const ipc = useIpc()
    const data = reactive({
      isShown: false,
      log: '',
      isCrash: false,
      crashReportLocation: '',
      errorLog: '',
    })
    const { getLogContent, getCrashReportContent, showLog } = useInstanceLogs()
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
    ipc.on('minecraft-exit', (event, { code, signal, crashReport, crashReportLocation, errorLog }) => {
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
