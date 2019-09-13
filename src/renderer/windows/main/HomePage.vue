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

    <v-menu v-show="refreshingProfile || problems.length !== 0" offset-y top dark max-height="300">
      <v-btn slot="activator" style="position: absolute; left: 200px; bottom: 10px; " :loading="refreshingProfile || missingJava"
             :flat="problems.length !== 0" outline dark :color="problemsLevelColor">
        <v-icon left dark :color="problemsLevelColor">
          {{ problems.length !== 0 ?
            'warning' : 'check_circle' }}
        </v-icon>
        {{ $tc('diagnosis.problem', problems.length, { count: problems.length }) }}
      </v-btn>

      <v-list>
        <template v-for="(item, index) in problems">
          <v-list-tile :key="index" ripple @click="fixProblem(item)">
            <v-list-tile-content>
              <v-list-tile-title>
                {{ $tc(`diagnosis.${item.id}`, item.arguments.count || 0, item.arguments) }}
              </v-list-tile-title>
              <v-list-tile-sub-title>
                {{ $t(`diagnosis.${item.id}.message`, item.arguments || {}) }}
              </v-list-tile-sub-title>
            </v-list-tile-content>
            <v-list-tile-action>
              <v-icon> {{ item.autofix?'build':'arrow_right' }} </v-icon>
            </v-list-tile-action>
          </v-list-tile>
        </template>
      </v-list>
    </v-menu>

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
      <v-card v-if="isServer" class="white--text">
        <v-layout>
          <v-flex xs5 style="padding: 5px 0">
            <v-card-title>
              <v-img :src="icon" height="125px" style="max-height: 125px;" contain />
            </v-card-title>
          </v-flex>
          <v-flex xs7>
            <v-card-title>
              <div>
                <div style="font-size: 20px;">
                  {{ $t(status.version.name) }}
                </div>
                <text-component :source="status.description" />

                <div> {{ $t('profile.server.players') }} : {{ status.players.online + '/' + status.players.max }} </div>
              </div>
            </v-card-title>
          </v-flex>
        </v-layout>
        <v-divider light />
        <v-card-actions class="pa-3">
          <v-icon left>
            signal_cellular_alt
          </v-icon>
          <div>  {{ $t('profile.server.pings') }} : {{ status.ping }} ms </div>
        
          <v-spacer />
          <v-btn v-if="isServer" flat dark large @click="refreshServer">
            <v-icon>
              refresh
            </v-icon>
          </v-btn>
        </v-card-actions>
      </v-card>
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
  </v-layout>
</template>

<script>
import unknownServer from 'renderer/assets/unknown_server.png';
import { PINGING_STATUS, createFailureServerStatus } from 'universal/utils/server-status';

export default {
  data: () => ({
    logsDialog: false,
    launchStatusDialog: false,
    feedbackDialog: false,
    crashDialog: false,
    javaWizardDialog: false,
  }),
  computed: {
    status() { return this.$repo.state.profile.status || {}; },
    icon() { return this.status.favicon || unknownServer; },
    isServer() { return this.profile.type === 'server'; },
    problems() { return this.$repo.getters.problems; },
    problemsLevelColor() { return this.problems.some(p => !p.optional) ? 'red' : 'warning'; },
    launchStatus() { return this.$repo.state.launch.status; },
    refreshingProfile() { return this.$repo.state.profile.refreshing; },
    missingJava() { return this.$repo.getters.missingJava; },
    profile() { return this.$repo.getters.selectedProfile; },
  },
  watch: {
    javaWizardDialog() {
      this.$electron.ipcRenderer.emit('task', false);
    },
  },
  mounted() {
  },
  methods: {
    async launch() {
      if (this.launchStatus !== 'ready') {
        this.launchStatusDialog = true;
        return;
      }
      await this.$repo.dispatch('launch');
    },
    showExportDialog() {
      if (this.refreshingProfile) return;
      this.$electron.remote.dialog.showSaveDialog({
        title: this.$t('profile.export.title'),
        filters: [{ name: 'zip', extensions: ['zip'] }],
        message: this.$t('profile.export.message'),
        defaultPath: `${this.profile.name}.zip`,
      }, (filename, bookmark) => {
        if (filename) {
          this.$repo.dispatch('exportProfile', { dest: filename }).catch((e) => {
            console.error(e);
          });
        }
      });
    },
    showLogDialog() {
      this.logsDialog = true;
    },
    showFeedbackDialog() {
      this.feedbackDialog = true;
    },
    fixProblem(problem) {
      console.log(problem);
      if (!problem.autofix) {
        this.handleManualFix(problem);
      } else {
        this.handleAutoFix();
      }
    },
    async handleManualFix(problem) {
      let handle;
      switch (problem.id) {
        case 'unknownMod':
        case 'incompatibleMod':
          this.$router.replace('/mod-setting');
          break;
        case 'incompatibleResourcePack':
          this.$router.replace('/resource-pack-setting');
          break;
        case 'incompatibleJava':
          if (this.$repo.state.java.all.some(j => j.majorVersion === 8)) {
            await this.$repo.dispatch('editProfile', { java: this.$repo.state.java.all.find(j => j.majorVersion === 8) });
            // TODO: notify user here the launcher switch java version
          } else {
            this.javaWizardDialog = true;
          }
          break;
        case 'missingModsOnServer':
          break;
        default:
      }
    },
    handleAutoFix() {
      this.$repo.dispatch('fixProfile', this.problems);
    },
    refreshServer() {
      this.$repo.dispatch('refreshProfile');
    },
    quitLauncher() {
      setTimeout(() => {
        this.$store.dispatch('quit');
      }, 150);
    },
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
