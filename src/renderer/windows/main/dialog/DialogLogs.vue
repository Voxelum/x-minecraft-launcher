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
          <v-tab :disabled="loadingList" @click="goLog">
            {{ $t('profile.logsCrashes.logs') }}
          </v-tab>
          <v-tab :disabled="loadingList" @click="goCrash">
            {{ $t('profile.logsCrashes.crashes') }}
          </v-tab>
        </v-tabs>
      </template>
    </v-toolbar>
    <v-tabs-items v-model="tab">
      <v-tab-item v-for="item in 2" :key="item">
        <div style="min-height: 450px; max-height: 450px; overflow: auto; background: #424242">
          <v-list v-if="!content" :key="0">
            <v-list-tile v-for="i in files" :key="i" v-ripple avatar @click="showFile(i)">
              <v-list-tile-avatar>
                <v-icon>
                  clear_all
                </v-icon>
              </v-list-tile-avatar>
              <v-list-tile-content>
                <v-list-tile-title>{{ i }}</v-list-tile-title>
              </v-list-tile-content>
              <v-list-tile-action>
                <v-list-tile-action>
                  <v-btn icon color="red" flat @click="removeFile($event, i)">
                    <v-icon>delete</v-icon>
                  </v-btn>
                </v-list-tile-action>
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
              no-resize
              hide-details
              :value="content" style="margin: 8px;" />
          </div>
        </div>
      </v-tab-item>
    </v-tabs-items>
  </v-dialog>
</template>

<script>
import { reactive, toRefs, watch } from '@vue/composition-api';
import { useStore, useDialogSelf } from '@/hooks';

export default {
  setup() {
    const { dispatch } = useStore();
    const { isShown, closeDialog } = useDialogSelf('logs');
    const data = reactive({
      tab: 0,

      loadingContent: false,
      loadingList: false,
      showedFile: '',
      files: [],

      content: '',
    });
    watch(isShown, (s) => { if (s) { loadLogs(); } });
    function loadLogs() {
      data.loadingList = true;
      dispatch('listLogs').then((l) => {
        data.files = l;
      }).finally(() => {
        data.loadingList = false;
      });
    }
    function loadCrashes() {
      data.loadingList = true;
      dispatch('listCrashReports').then((l) => {
        data.files = l;
      }).finally(() => {
        data.loadingList = false;
      });
    }
    return {
      isShown,
      ...toRefs(data),
      removeFile(event, i) {
        if (data.tab === 1) {
          dispatch('removeCrashReport', i);
          loadCrashes();
        } else {
          dispatch('removeLog', i);
          loadLogs();
        }
        event.preventDefault();
      },
      showFile(i) {
        const name = i;
        if (name !== data.showedFile) {
          data.loadingContent = true;
          data.showedFile = name;
          if (data.tab === 1) {
            dispatch('getLogContent', name)
              .then((c) => {
                data.content = c;
              }).finally(() => {
                data.loadingContent = false;
              });
          } else {
            dispatch('getLogContent', name)
              .then((c) => {
                data.content = c;
              }).finally(() => {
                data.loadingContent = false;
              });
          }
        }
      },
      goBack() {
        data.content = '';
      },
      goLog() {
        data.tab = 0;
        data.content = '';
        loadLogs();
      },
      goCrash() {
        data.tab = 1;
        data.content = '';
        loadCrashes();
      },
      close() {
        closeDialog();
      },
    };
  },
};
</script>

<style>
</style>
