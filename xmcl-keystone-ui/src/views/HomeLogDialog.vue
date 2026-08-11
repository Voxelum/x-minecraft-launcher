<template>
  <v-dialog
    v-model="isShown"
    :width="1200"
    :content-props="{ 'aria-labelledby': 'log-dialog-title' }"
  >
    <v-card>
      <v-toolbar class="select-none" color="warning">
        <v-toolbar-title id="log-dialog-title" class="text-white">
          {{ t("logsCrashes.title") }}
        </v-toolbar-title>
        <v-spacer />
        <v-btn
          icon="close"
          :aria-label="t('shared.close')"
          @click="hide"
        />

        <template #extension>
          <v-tabs v-model="data.tab" color="white" slider-color="yellow">
            <v-tab :value="0" :disabled="data.loadingList" @click="goLog">
              {{ t("logsCrashes.logs") }}
            </v-tab>
            <v-tab :value="1" :disabled="data.loadingList" @click="goCrash">
              {{ t("logsCrashes.crashes") }}
            </v-tab>
            <v-tab
              v-if="data.serverLogs.length > 0"
              :value="2"
              :disabled="data.loadingList"
              @click="goServerLogs"
            >
              {{ t("logsCrashes.serverLogs") }}
              <v-chip
                size="x-small"
                class="ml-2"
                color="white"
                variant="tonal"
                label
              >
                {{ data.serverLogs.length }}
              </v-chip>
            </v-tab>
          </v-tabs>
        </template>
      </v-toolbar>
      <v-tabs-window v-model="data.tab" class="bg-transparent">
        <v-tabs-window-item :value="0">
          <TabItem
            log
            :visible="data.tab === 0 && isShown"
            :files="data.logs"
            :refreshing="data.loadingList"
            :get-file-content="_getLogContent"
            :remove-file="removeLog"
            :show-file="_showLog"
          />
        </v-tabs-window-item>
        <v-tabs-window-item :value="1">
          <TabItem
            :visible="data.tab === 1 && isShown"
            :files="data.crashes"
            :refreshing="data.loadingList"
            :get-file-content="_getCrashReportContent"
            :get-launch-id="_getCrashReportLaunchId"
            :remove-file="removeCrashReport"
            :show-file="_showCrashReport"
          />
        </v-tabs-window-item>
        <v-tabs-window-item :value="2">
          <TabItem
            log
            :visible="data.tab === 2 && isShown"
            :files="data.serverLogs"
            :refreshing="data.loadingList"
            :get-file-content="_getServerLogContent"
            :remove-file="removeServerLog"
            :show-file="_showServerLog"
          />
        </v-tabs-window-item>
      </v-tabs-window>
    </v-card>
  </v-dialog>
</template>

<script lang="ts" setup>
import { useService } from "@/composables";
import { kInstance } from "@/composables/instance";
import { injection } from "@/util/inject";
import { InstanceLogServiceKey } from "@xmcl/runtime-api";
import { useDialog } from "../composables/dialog";
import TabItem from "./HomeLogDialogTab.vue";

const {
  listLogs,
  listCrashReports,
  listServerLogs,
  removeLog: rmLog,
  removeCrashReport: rmCrash,
  removeServerLog: rmServerLog,
  getCrashReportContent,
  findLaunchByCrashReport,
  getLogContent,
  getServerLogContent,
  showLog,
  showCrash: showCrashReport,
  showServerLog: showServerLogFile,
} = useService(InstanceLogServiceKey);
const { isShown, hide } = useDialog("log");
const { t } = useI18n();

const { path } = injection(kInstance);

const data = reactive({
  tab: null as any as number,
  loadingContent: false,
  loadingList: false,
  logs: [] as string[],
  crashes: [] as string[],
  serverLogs: [] as string[],
});
const _getLogContent = (name: string) => getLogContent(path.value, name);
const _getCrashReportContent = (name: string) =>
  getCrashReportContent(path.value, name);
const _getCrashReportLaunchId = (name: string) =>
  findLaunchByCrashReport(path.value, name).then((launch) => launch?.launchId);
const _getServerLogContent = (name: string) =>
  getServerLogContent(path.value, name);
const _showLog = (name: string) => showLog(path.value, name);
const _showCrashReport = (name: string) => showCrashReport(path.value, name);
const _showServerLog = (name: string) => showServerLogFile(path.value, name);

function loadLogs() {
  data.loadingList = true;
  listLogs(path.value)
    .then((l) => {
      data.logs = l;
    })
    .finally(() => {
      data.loadingList = false;
    });
}
function loadCrashes() {
  data.loadingList = true;
  listCrashReports(path.value)
    .then((l) => {
      data.crashes = l;
    })
    .finally(() => {
      data.loadingList = false;
    });
}
function loadServerLogs() {
  data.loadingList = true;
  listServerLogs(path.value)
    .then((l) => {
      data.serverLogs = l;
    })
    .finally(() => {
      data.loadingList = false;
    });
}
async function removeLog(name: string) {
  await rmLog(path.value, name);
  loadLogs();
}
async function removeCrashReport(name: string) {
  await rmCrash(path.value, name);
  loadCrashes();
}
async function removeServerLog(name: string) {
  await rmServerLog(path.value, name);
  loadServerLogs();
}
watch(isShown, (s) => {
  if (s) {
    data.tab = 0;
    loadLogs();
    // Eagerly load the server logs so the Server Logs tab only appears when
    // the instance has actually produced any (and its badge count is right).
    loadServerLogs();
  } else {
    data.logs = [];
    data.crashes = [];
    data.serverLogs = [];
  }
});
function goLog() {
  data.tab = 0;

  loadLogs();
}
function goCrash() {
  data.tab = 1;
  loadCrashes();
}
function goServerLogs() {
  data.tab = 2;
  loadServerLogs();
}
</script>

<style></style>
