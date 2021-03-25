<template>
  <v-dialog
    :value="value"
    :width="550"
    @input="$emit($event)"
  >
    <v-toolbar
      color="warning"
      tabs
    >
      <v-toolbar-title class="white--text">
        {{ $t('profile.logsCrashes.title') }}
      </v-toolbar-title>
      <v-spacer />
      <v-btn
        icon
        @click="hide"
      >
        <v-icon>arrow_drop_down</v-icon>
      </v-btn>

      <template #extension>
        <v-tabs
          v-model="tab"
          align-with-title
        >
          <v-tabs-slider color="yellow" />
          <v-tab
            :key="0"
            :disabled="loadingList"
            @click="goLog"
          >
            {{ $t('profile.logsCrashes.logs') }}
          </v-tab>
          <v-tab
            :key="1"
            :disabled="loadingList"
            @click="goCrash"
          >
            {{ $t('profile.logsCrashes.crashes') }}
          </v-tab>
        </v-tabs>
      </template>
    </v-toolbar>
    <v-tabs-items v-model="tab">
      <tab-item
        :key="0"
        :files="logs"
        :get-file-content="getLogContent"
        :remove-file="removeLog"
        :show-file="showLog"
      />
      <tab-item
        :key="1"
        :files="crashes"
        :get-file-content="getCrashReportContent"
        :remove-file="removeCrashReport"
        :show-file="showCrashReport"
      />
    </v-tabs-items>
  </v-dialog>
</template>

<script lang=ts>
import { reactive, toRefs, watch, defineComponent } from '@vue/composition-api'
import { useInstanceLogs } from '/@/hooks'
import { required } from '/@/util/props'
import TabItem from './HomePageLogDialogTab.vue'

export default defineComponent({
  components: {
    TabItem,
  },
  props: {
    value: required(Boolean),
    hide: required<() => void>(Function),
  },
  setup(props) {
    const {
      listLogs,
      listCrashReports,
      removeLog,
      removeCrashReport,
      getCrashReportContent,
      getLogContent,
      showLog,
      showCrash: showCrashReport,
    } = useInstanceLogs()
    const data = reactive({
      tab: null as any as number,
      loadingContent: false,
      loadingList: false,
      logs: [] as string[],
      crashes: [] as string[],
    })
    function loadLogs() {
      data.loadingList = true
      listLogs().then((l) => {
        data.logs = l
      }).finally(() => {
        data.loadingList = false
      })
    }
    function loadCrashes() {
      data.loadingList = true
      listCrashReports().then((l) => {
        data.crashes = l
      }).finally(() => {
        data.loadingList = false
      })
    }
    watch(() => props.value, (s) => {
      if (s) {
        data.tab = 0
        loadLogs()
      }
    })
    return {
      removeLog,
      removeCrashReport,
      getCrashReportContent,
      getLogContent,
      showLog,
      showCrashReport,
      ...toRefs(data),
      goLog() {
        data.tab = 0
        loadLogs()
      },
      goCrash() {
        data.tab = 1
        loadCrashes()
      },
    }
  },
})
</script>

<style>
</style>
