<template>
  <v-dialog v-model="isShown" :width="550">
    <v-toolbar color="warning" tabs>
      <v-toolbar-title class="white--text">
        {{ $t('profile.logsCrashes.title') }}
      </v-toolbar-title>
      <v-spacer />
      <v-btn icon @click="close">
        <v-icon>arrow_drop_down</v-icon>
      </v-btn>

      <template v-slot:extension>
        <v-tabs
          v-model="tab"
          align-with-title
        >
          <v-tabs-slider color="yellow" />
          <v-tab :key="0" :disabled="loadingList" @click="goLog">
            {{ $t('profile.logsCrashes.logs') }}
          </v-tab>
          <v-tab :key="1" :disabled="loadingList" @click="goCrash">
            {{ $t('profile.logsCrashes.crashes') }}
          </v-tab>
        </v-tabs>
      </template>
    </v-toolbar>
    <v-tabs-items v-model="tab">
      <template v-for="item in [0, 1]">
        <v-tab-item :key="item">
          <div style="min-height: 420px; max-height: 420px; overflow: auto; background: #424242">
            <transition name="fade-transition" mode="out-in">
              <v-list v-if="contents[item] === ''" :key="0">
                <v-list-tile v-for="i in files" :key="i" v-ripple :disabled="loadingContent" avatar @click="showFile(i)">
                  <v-list-tile-avatar>
                    <v-icon>
                      clear_all
                    </v-icon>
                  </v-list-tile-avatar>
                  <v-list-tile-content>
                    <v-list-tile-title>{{ i }}</v-list-tile-title>
                  </v-list-tile-content>
                  <v-list-tile-action>
                    <v-btn icon color="white" flat @click.prevent.stop="openFile(i)">
                      <v-icon>folder</v-icon>
                    </v-btn>
                  </v-list-tile-action>
                  <v-list-tile-action>
                    <v-btn icon color="red" flat @click.prevent.stop="removeFile(i)">
                      <v-icon>delete</v-icon>
                    </v-btn>
                  </v-list-tile-action>
                </v-list-tile>
              </v-list>
              <div v-else :key="1">
                <v-card-title primary-title>
                  {{ showedFile }}
                  <v-spacer />
                  <v-btn flat @click="goBack">
                    <v-icon left>
                      arrow_back
                    </v-icon>
                    {{ $t('back') }}
                  </v-btn>
                </v-card-title>
                <v-textarea 
                  auto-grow
                  autofocus
                  box
                  readonly
                  hide-details
                  :value="contents[item]" 
                  style="margin: 8px;" />
              </div>
            </transition>
          </div>
        </v-tab-item>
      </template>
    </v-tabs-items>
  </v-dialog>
</template>

<script lang=ts>
import { reactive, toRefs, watch, set, createComponent, computed } from '@vue/composition-api';
import { useDialogSelf, useInstanceLogs } from '@/hooks';

export default createComponent({
  setup() {
    const {
      listLogs,
      listCrashReports,
      removeLog,
      removeCrashReport,
      getCrashReportContent,
      getLogContent,
      showLog,
      showCrash: showCrashReport,
    } = useInstanceLogs();
    const { isShown, closeDialog } = useDialogSelf('logs');
    const data = reactive({
      tab: null as any as number,

      loadingContent: false,
      loadingList: false,
      showedFile: '',
      logs: [] as string[],
      crashs: [] as string[],

      contents: ['', ''],
    });
    const files = computed(() => (data.tab === 0 ? data.logs : data.crashs));
    function loadLogs() {
      console.log('loadLogs');
      data.loadingList = true;
      listLogs().then((l) => {
        data.logs = l;
      }).finally(() => {
        data.loadingList = false;
      });
    }
    watch(isShown, (s) => {
      if (s) {
        data.tab = 0;
        loadLogs();
      }
    });
    function loadCrashes() {
      data.loadingList = true;
      listCrashReports().then((l) => {
        data.crashs = l;
      }).finally(() => {
        data.loadingList = false;
      });
    }
    return {
      files,
      isShown,
      ...toRefs(data),
      removeFile(i: string) {
        if (data.tab === 1) {
          removeCrashReport(i);
          loadCrashes();
        } else {
          removeLog(i);
          loadLogs();
        }
      },
      showFile(i: string) {
        const name = i;
        if (data.loadingContent) return;
        if (name !== data.showedFile) {
          data.loadingContent = true;
          data.showedFile = name;
          if (data.tab === 1) {
            getCrashReportContent(name)
              .then((c) => {
                data.contents[1] = c;
              }).finally(() => {
                data.loadingContent = false;
              });
          } else {
            getLogContent(name)
              .then((c) => {
                data.contents[0] = c;
              }).finally(() => {
                data.loadingContent = false;
              });
          }
        }
      },
      openFile(name: string) {
        if (data.tab === 1) {
          showCrashReport(name);
        } else {
          showLog(name);
        }
      },
      goBack() {
        set(data.contents, data.tab, '');
      },
      goLog() {
        data.tab = 0;
        loadLogs();
      },
      goCrash() {
        data.tab = 1;
        loadCrashes();
      },
      close() {
        closeDialog();
      },
    };
  },
});
</script>

<style>
</style>
