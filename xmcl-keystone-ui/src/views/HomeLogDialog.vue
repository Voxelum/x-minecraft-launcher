<template>
  <v-dialog
    v-model="isShown"
    :width="700"
  >
    <v-card>
      <v-toolbar
        color="warning"
        tabs
      >
        <v-toolbar-title class="white--text">
          {{ t('logsCrashes.title') }}
        </v-toolbar-title>
        <v-spacer />
        <v-btn
          icon
          @click="hide"
        >
          <v-icon>close</v-icon>
        </v-btn>

        <template #extension>
          <v-tabs
            v-model="data.tab"
            align-with-title
            color="white"
          >
            <v-tabs-slider color="yellow" />
            <v-tab
              :key="0"
              :disabled="data.loadingList"
              @click="goLog"
            >
              {{ t('logsCrashes.logs') }}
            </v-tab>
            <v-tab
              :key="1"
              :disabled="data.loadingList"
              @click="goCrash"
            >
              {{ t('logsCrashes.crashes') }}
            </v-tab>
          </v-tabs>
        </template>
      </v-toolbar>
      <v-tabs-items
        v-model="data.tab"
        class="bg-transparent"
      >
        <TabItem
          :key="0"
          log
          :visible="data.tab === 0 && isShown"
          :files="data.logs"
          :refreshing="data.loadingList"
          :get-file-content="_getLogContent"
          :remove-file="removeLog"
          :show-file="_showLog"
        />
        <TabItem
          :key="1"
          :visible="data.tab === 1 && isShown"
          :files="data.crashes"
          :refreshing="data.loadingList"
          :get-file-content="_getCrashReportContent"
          :remove-file="removeCrashReport"
          :show-file="_showCrashReport"
        />
      </v-tabs-items>
    </v-card>
  </v-dialog>
</template>

<script lang=ts setup>
import { useService } from '@/composables'
import { kInstance } from '@/composables/instance'
import { injection } from '@/util/inject'
import { InstanceLogServiceKey } from '@xmcl/runtime-api'
import { useDialog } from '../composables/dialog'
import TabItem from './HomeLogDialogTab.vue'

const {
  listLogs,
  listCrashReports,
  removeLog: rmLog,
  removeCrashReport: rmCrash,
  getCrashReportContent,
  getLogContent,
  showLog,
  showCrash: showCrashReport,
} = useService(InstanceLogServiceKey)
const { isShown, hide } = useDialog('log')
const { t } = useI18n()

const { path } = injection(kInstance)

const data = reactive({
  tab: null as any as number,
  loadingContent: false,
  loadingList: false,
  logs: [] as string[],
  crashes: [] as string[],
})
const _getLogContent = (name: string) => getLogContent(path.value, name)
const _getCrashReportContent = (name: string) => getCrashReportContent(path.value, name)
const _showLog = (name: string) => showLog(path.value, name)
const _showCrashReport = (name: string) => showCrashReport(path.value, name)

function loadLogs() {
  data.loadingList = true
  listLogs(path.value).then((l) => {
    data.logs = l
  }).finally(() => {
    data.loadingList = false
  })
}
function loadCrashes() {
  data.loadingList = true
  listCrashReports(path.value).then((l) => {
    data.crashes = l
  }).finally(() => {
    data.loadingList = false
  })
}
async function removeLog(name: string) {
  await rmLog(path.value, name)
  loadLogs()
}
async function removeCrashReport(name: string) {
  await rmCrash(path.value, name)
  loadCrashes()
}
watch(isShown, (s) => {
  if (s) {
    data.tab = 0
    loadLogs()
  } else {
    data.logs = []
    data.crashes = []
  }
})
function goLog() {
  data.tab = 0

  loadLogs()
}
function goCrash() {
  data.tab = 1
  loadCrashes()
}
</script>

<style>
</style>
