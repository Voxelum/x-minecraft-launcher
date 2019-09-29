<template>
  <v-layout row wrap>
    <v-icon v-ripple style="position: absolute; right: 0; top: 0; z-index: 2; margin: 0; padding: 10px; cursor: pointer; border-radius: 2px; user-select: none;"
            dark @click="quitLauncher">
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
               @click="showLogDialog">
          <v-icon dark>
            subtitles
          </v-icon>
        </v-btn>
      </template>
      {{ $t('profile.logsCrashes.title') }}
    </v-tooltip>

    <problems-bar />
    <v-flex d-flex xs12 style="z-index: 1">
      <div class="display-1 white--text" style="padding-top: 50px; padding-left: 50px">
        <span style="margin-right: 10px;">
          {{ profile.name || `Minecraft ${profile.version.minecraft}` }}
        </span>
        <v-chip v-if="profile.author" label color="green" small :selected="false" style="margin-right: 5px;">
          {{ profile.author }}
        </v-chip>

        <v-chip label class="pointer" color="green" small :selected="false" @click="$router.replace('/version-setting')">
          Version: {{ $repo.getters['currentVersion'].id }}
        </v-chip>
      </div>
    </v-flex>
    
    <v-flex d-flex xs6 style="margin: 40px 0 0 40px;">
      <server-status-card v-if="isServer" />
    </v-flex>

    <v-btn color="primary" style="position: absolute; right: 10px; bottom: 10px; " dark large
           :disabled="refreshingProfile || missingJava"
           @click="launch">
      {{ $t('launch.launch') }}
      <v-icon v-if="launchStatus === 'ready' || launchStatus === 'error'" right> 
        play_arrow
      </v-icon>
      <v-progress-circular v-else class="v-icon--right" indeterminate :size="20" :width="2" />
    </v-btn>

    <dialog-logs v-model="logsDialog" />
    <dialog-crash-report v-model="crashDialog" />
    <dialog-java-wizard v-model="javaWizardDialog" @task="$electron.ipcRenderer.emit('task')" />
    <dialog-feedback v-model="feedbackDialog" />
    <dialog-launch-status v-model="launchStatusDialog" />
    <dialog-download-missing-server-mods v-model="downloadMissingModsDialog" />
  </v-layout>
</template>

<script>
import unknownServer from 'renderer/assets/unknown_server.png';
import { PINGING_STATUS, createFailureServerStatus } from 'universal/utils/server-status';
import { reactive, computed, toRefs, watch, ref } from '@vue/composition-api';
import useStore from '@/hooks/useStore';
import useRouter from '@/hooks/useRouter';
import { ipcRenderer, remote } from 'electron';

export default {
  setup(props, context) {
    const $t = context.root.$t;
    const router = useRouter();
    const { getters, state, dispatch } = useStore();
    const data = reactive({
      logsDialog: false,
      launchStatusDialog: false,
      feedbackDialog: false,
      crashDialog: false,
      javaWizardDialog: false,
      downloadMissingModsDialog: false,
    });
    const profile = computed(() => getters.selectedProfile);
    const isServer = computed(() => profile.value.type === 'server');
    const launchStatus = computed(() => state.launch.status);
    const refreshingProfile = computed(() => state.profile.refreshing);
    const missingJava = computed(() => getters.missingJava);

    watch(() => {
      if (data.javaWizardDialog) {
        ipcRenderer.emit('task', false);
      }
    });
    return {
      ...toRefs(data),
      isServer,
      profile,
      launchStatus,
      refreshingProfile,
      missingJava,
      async launch() {
        if (launchStatus.value !== 'ready') {
          data.launchStatusDialog = true;
          return;
        }
        await dispatch('launch');
      },
      showExportDialog() {
        if (refreshingProfile.value) return;
        remote.dialog.showSaveDialog({
          title: $t('profile.export.title'),
          filters: [{ name: 'zip', extensions: ['zip'] }],
          message: $t('profile.export.message'),
          defaultPath: `${data.profile.name}.zip`,
        }, (filename, bookmark) => {
          if (filename) {
            dispatch('exportProfile', { dest: filename }).catch((e) => {
              console.error(e);
            });
          }
        });
      },
      showLogDialog() { data.logsDialog = true; },
      showFeedbackDialog() { data.feedbackDialog = true; },
      quitLauncher() {
        setTimeout(() => {
          dispatch('quit');
        }, 150);
      },
    };
  },
};
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
