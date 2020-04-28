<template>
  <v-layout row wrap>
    <v-icon v-ripple style="position: absolute; right: 0; top: 0; z-index: 2; margin: 0; padding: 10px; cursor: pointer; border-radius: 2px; user-select: none;"
            dark @click="quit">
      close
    </v-icon>
    <v-icon v-ripple style="position: absolute; right: 44px; top: 0; z-index: 2; margin: 0; padding: 10px; cursor: pointer; border-radius: 2px; user-select: none;"
            dark @click="showFeedbackDialog">
      help_outline
    </v-icon>

    <v-tooltip top>
      <template v-slot:activator="{ on }">
        <v-btn style="position: absolute; left: 20px; bottom: 10px; " flat icon dark to="/base-setting" v-on="on">
          <v-icon dark>
            more_vert
          </v-icon>
        </v-btn>
      </template>
      {{ $t('profile.setting') }}
    </v-tooltip>

    <v-tooltip top>
      <template v-slot:activator="{ on }">
        <v-btn style="position: absolute; left: 80px; bottom: 10px; " 
               flat icon dark 
               :loading="refreshing"
               v-on="on"
               @click="showExportDialog">
          <v-icon dark>
            share
          </v-icon>
        </v-btn>
      </template>
      {{ $t('profile.modpack.export') }}
    </v-tooltip>

    <v-tooltip top>
      <template v-slot:activator="{ on }">
        <v-btn style="position: absolute; left: 140px; bottom: 10px; " flat icon dark v-on="on"
               @click="showLogDialog">
          <v-icon dark>
            subtitles
          </v-icon>
        </v-btn>
      </template>
      {{ $t('profile.logsCrashes.title') }}
    </v-tooltip>

    <problems-bar />
    <v-flex d-flex xs12 style="z-index: 1; padding-top: 50px; padding-left: 50px">
      <home-header />
    </v-flex>
    
    <v-flex v-if="isServer" d-flex xs12 style="margin: 40px;">
      <server-status-bar />
    </v-flex>

    <v-btn color="primary" style="position: absolute; right: 10px; bottom: 10px; " dark large
           :disabled="refreshing || missingJava"
           @click="launch">
      {{ $t('launch.launch') }}
      <v-icon v-if="launchStatus === 'ready'" right> 
        play_arrow
      </v-icon>
      <v-progress-circular v-else class="v-icon--right" indeterminate :size="20" :width="2" />
    </v-btn>
    <log-dialog v-model="isLogDialogShown" :hide="hideLogDialog" />
    <game-exit-dialog />
    <feedback-dialog />
  </v-layout>
</template>

<script lang=ts>
import { createComponent, watch } from '@vue/composition-api';
import { LaunchException } from '@universal/util/exception';
import {
  useI18n,
  useLaunch,
  useNativeDialog,
  useInstance,
  useJava,
  useQuit,
} from '@/hooks';
import GameExitDialog from './HomePage/HomePageGameExitDialog.vue';
import LaunchBlockedDialog from './HomePage/HomePageLaunchBlockedDialog.vue';
import FeedbackDialog from './HomePage/HomePageFeedbackDialog.vue';
import LogDialog from './HomePage/HomePageLogDialog.vue';
import HomeHeader from './HomePage/HomePageHeader.vue';
import ProblemsBar from './HomePage/HomePageProblemsBar.vue';
import ServerStatusBar from './HomePage/HomePageServerStatusBar.vue';
import { useDialog, useNotifier } from '../hooks';

function compositeLaunch() {
  const { notify } = useNotifier();
  const { launch, status: launchStatus, errors, errorType } = useLaunch();
  const { show: showLaunchStatusDialog, hide: hideLaunchStatusDialog } = useDialog('launch-status');
  const { show: showLaunchBlockedDialog } = useDialog('launch-blocked');

  watch([errors, errorType], () => {
    if (errors.value.length !== 0 || errorType.value.length !== 0) {
      notify('error', `[${errorType.value}] ${errors.value}`);
    }
  });

  return {
    launchStatus,
    hideLaunchStatusDialog,
    launch() {
      if (launchStatus.value === 'checkingProblems' || launchStatus.value === 'launching' || launchStatus.value === 'launched') {
        showLaunchStatusDialog();
      } else {
        launch().catch((e: LaunchException) => {
          if (e.type === 'launchBlockedIssues') {
            showLaunchBlockedDialog();
          } else if (e.type === 'launchGeneralException') {
            // TODO: support this
          }
        });
      }
    },
  };
}

export default createComponent({
  components: {
    LaunchBlockedDialog,
    LogDialog,
    ProblemsBar,
    HomeHeader,
    ServerStatusBar,
    GameExitDialog,
    FeedbackDialog,
  },
  setup() {
    const { $t } = useI18n();
    const { showSaveDialog } = useNativeDialog();
    const { isShown: isLogDialogShown, show: showLogDialog, hide: hideLogDialog } = useDialog('log');
    const { show: showFeedbackDialog } = useDialog('feedback');
    const { refreshing, name, isServer, exportInstance: exportTo } = useInstance();
    const { subscribe } = useNotifier();
    const { missing: missingJava } = useJava();
    const { quit } = useQuit();

    return {
      isServer,
      refreshing,
      missingJava,
      showFeedbackDialog,
      quit,

      ...compositeLaunch(),

      showLogDialog,
      isLogDialogShown,
      hideLogDialog,

      async showExportDialog() {
        if (refreshing.value) return;
        const { filePath } = await showSaveDialog({
          title: $t('profile.export.title'),
          filters: [{ name: 'zip', extensions: ['zip'] }],
          message: $t('profile.export.message'),
          defaultPath: `${name.value}.zip`,
        });
        if (filePath) {
          subscribe(exportTo({ destinationPath: filePath, mode: 'full' }),
            () => $t('profile.export.title'),
            () => $t('profile.export.title'));
        }
      },
    };
  },
});
</script>

<style>
.v-dialog__content--active {
  -webkit-app-region: no-drag;
  user-select: auto;
}
.v-dialog {
  -webkit-app-region: no-drag;
  user-select: auto;
}
.v-badge__badge.primary {
  right: -10px;
  height: 20px;
  width: 20px;
  font-size: 12px;
}

.pointer * {
  cursor: pointer !important;
}
</style>
