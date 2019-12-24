<template>
  <v-layout row wrap>
    <v-icon v-ripple style="position: absolute; right: 0; top: 0; z-index: 2; margin: 0; padding: 10px; cursor: pointer; border-radius: 2px; user-select: none;"
            dark @click="quit">
      close
    </v-icon>
    <v-icon v-ripple style="position: absolute; right: 44px; top: 0; z-index: 2; margin: 0; padding: 10px; cursor: pointer; border-radius: 2px; user-select: none;"
            dark @click="showFeedbackDialog()">
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
               :loading="refreshingProfile"
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
               @click="showLogDialog()">
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
           :disabled="refreshingProfile || missingJava"
           @click="launch">
      {{ $t('launch.launch') }}
      <v-icon v-if="launchStatus === 'ready'" right> 
        play_arrow
      </v-icon>
      <v-progress-circular v-else class="v-icon--right" indeterminate :size="20" :width="2" />
    </v-btn>
    <dialog-launch-status />
    <dialog-launch-blocked />
    <dialog-logs />
  </v-layout>
</template>

<script lang=ts>
import { createComponent, watch } from '@vue/composition-api';
import { LaunchException } from 'universal/utils';
import {
  useDialog,
  useI18n,
  useLaunch,
  useNativeDialog,
  useInstance,
  useJava,
  useQuit,
  useNotifier,
} from '@/hooks';
import DialogLaunchStatus from './HomePage/DialogLaunchStatus.vue';
import DialogLaunchBlocked from './HomePage/DialogLaunchBlocked.vue';
import DialogLogs from './HomePage/DialogLogs.vue';
import HomeHeader from './HomePage/HomeHeader.vue';
import ProblemsBar from './HomePage/ProblemsBar.vue';
import ServerStatusBar from './HomePage/ServerStatusBar.vue';

export default createComponent({
  components: {
    DialogLaunchStatus,
    DialogLogs,
    ProblemsBar,
    HomeHeader,
    ServerStatusBar,
    DialogLaunchBlocked,
  },
  setup() {
    const { $t } = useI18n();
    const { showSaveDialog } = useNativeDialog();
    const { showDialog: showLogDialog } = useDialog('logs');
    const { showDialog: showFeedbackDialog } = useDialog('feedback');
    const { showDialog: showLaunchStatusDialog } = useDialog('launch-status');
    const { showDialog: showLaunchBlockedDialog } = useDialog('launch-blocked');
    const { refreshing: refreshingProfile, name, isServer, exportTo } = useInstance();
    const { launch, status: launchStatus, errors, errorType } = useLaunch();
    const { notify, subscribe } = useNotifier();
    const { missing: missingJava } = useJava();
    const { quit } = useQuit();

    watch([errors, errorType], () => {
      if (errors.value.length !== 0 || errorType.value.length !== 0) {
        notify('error', `[${errorType.value}] ${errors.value}`);
      }
    });

    return {
      isServer,
      launchStatus,
      refreshingProfile,
      missingJava,
      showLogDialog,
      showFeedbackDialog,
      quit,
      launch() {
        if (launchStatus.value === 'checkingProblems' || launchStatus.value === 'launching' || launchStatus.value === 'launched') {
          showLaunchStatusDialog();
        } else {
          launch().catch((e: LaunchException) => {
            if (e.type === 'launchBlockedIssues') {
              showLaunchBlockedDialog();
            } else if (e.type === 'launchGeneralException') { }
          });
        }
      },
      async showExportDialog() {
        if (refreshingProfile.value) return;
        const { filePath } = await showSaveDialog({
          title: $t('profile.export.title'),
          filters: [{ name: 'zip', extensions: ['zip'] }],
          message: $t('profile.export.message'),
          defaultPath: `${name.value}.zip`,
        });
        if (filePath) {
          subscribe(exportTo({ dest: filePath, type: 'full' }),
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
