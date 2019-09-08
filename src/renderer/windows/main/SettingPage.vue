<template>
  <v-container grid-list-md fluid style="z-index: 1">
    <v-layout wrap style="padding: 6px; 8px; overflow: auto; max-height: 95vh" fill-height>
      <v-flex d-flex xs12 tag="h1" style="margin-bottom: 20px; " class="white--text">
        <span class="headline">{{ $tc('setting.name', 2) }}</span>
      </v-flex>
      <v-flex d-flex xs12>
        <v-list three-line subheader style="background: transparent; width: 100%">
          <v-subheader>{{ $t('setting.general') }}</v-subheader>
          <v-list-tile>
            <v-list-tile-content>
              <v-list-tile-title> {{ $t('setting.language') }} </v-list-tile-title>
              <v-list-tile-sub-title>
                {{ $t('setting.languageDescription') }}
              </v-list-tile-sub-title>
            </v-list-tile-content>
            <v-list-tile-action>
              <v-select v-model="selectedLang" style="max-width: 185px;" dark hide-details :items="langs" />
            </v-list-tile-action>
          </v-list-tile>
          <v-list-tile>
            <v-list-tile-content>
              <v-list-tile-title>{{ $t('setting.location') }}</v-list-tile-title>
              <v-list-tile-sub-title>
                {{ rootLocation }}
              </v-list-tile-sub-title>
            </v-list-tile-content>
            <v-list-tile-action>
              <v-btn outline flat style="margin-right: 10px;" @click="browseRootDir">
                {{ $t('setting.browseRoot') }}
              </v-btn>
            </v-list-tile-action>
            <v-list-tile-action>
              <v-btn outline flat @click="showRootDir">
                {{ $t('setting.showRoot') }}
              </v-btn>
            </v-list-tile-action>
          </v-list-tile>
          <v-list-tile>
            <v-list-tile-action>
              <v-checkbox v-model="useBmclAPI" />
            </v-list-tile-action>
            <v-list-tile-content>
              <v-list-tile-title> {{ $t('setting.useBmclAPI') }} </v-list-tile-title>
              <v-list-tile-sub-title> {{ $t('setting.useBmclAPIDescription') }} </v-list-tile-sub-title>
            </v-list-tile-content>
          </v-list-tile>
        </v-list>
      </v-flex>
      <v-divider dark />
      <v-flex style="background: transparent">
        <v-list three-line subheader style="background: transparent">
          <v-subheader>{{ $t('setting.update') }}</v-subheader>
          <v-list-tile avatar>
            <v-list-tile-action>
              <v-btn icon :loading="checkingUpdate" @click="checkUpdate">
                <v-icon>
                  refresh
                </v-icon>
              </v-btn>
            </v-list-tile-action>
            <v-list-tile-content>
              <v-list-tile-title> {{ $t('setting.latestVersion') }} </v-list-tile-title>
              <v-list-tile-sub-title> {{ updateInfo.version || 'Unknown' }} </v-list-tile-sub-title>
            </v-list-tile-content>
            <v-list-tile-action>
              <v-btn v-if="!readyToUpdate" flat @click="viewUpdateDetail">
                {{ $t('setting.updateToThisVersion') }}
              </v-btn>
              <v-btn v-else block @click="viewUpdateDetail">
                {{ $t('setting.installAndQuit') }}
              </v-btn>
            </v-list-tile-action>
          </v-list-tile>
          <v-list-tile avatar>
            <v-list-tile-action>
              <v-checkbox v-model="autoInstallOnAppQuit" />
            </v-list-tile-action>
            <v-list-tile-content>
              <v-list-tile-title> {{ $t('setting.autoInstallOnAppQuit') }} </v-list-tile-title>
              <v-list-tile-sub-title> {{ $t('setting.autoInstallOnAppQuitDescription') }} </v-list-tile-sub-title>
            </v-list-tile-content>
          </v-list-tile>
          <v-list-tile avatar>
            <v-list-tile-action>
              <v-checkbox v-model="autoDownload" dark />
            </v-list-tile-action>
            <v-list-tile-content>
              <v-list-tile-title> {{ $t('setting.autoDownload') }} </v-list-tile-title>
              <v-list-tile-sub-title> {{ $t('setting.autoDownloadDescription') }} </v-list-tile-sub-title>
            </v-list-tile-content>
          </v-list-tile>
          <v-list-tile avatar>
            <v-list-tile-action>
              <v-checkbox v-model="allowPrerelease" />
            </v-list-tile-action>
            <v-list-tile-content>
              <v-list-tile-title> {{ $t('setting.allowPrerelease') }} </v-list-tile-title>
              <v-list-tile-sub-title> {{ $t('setting.allowPrereleaseDescription') }} </v-list-tile-sub-title>
            </v-list-tile-content>
          </v-list-tile>
        </v-list>
      </v-flex>

      <!-- <p class="white--text" style="position: absolute; bottom: 35px; right: 315px;">
        <a href="https://github.com/voxelum/voxelauncher"> Github Repo </a>
      </p>

      <p class="white--text" style="position: absolute; bottom: 10px; right: 300px;">
        Present by <a href="https://github.com/ci010"> CI010 </a>
      </p> -->
    </v-layout>

    <dialog-update-info v-model="viewingUpdateDetail" />
    <v-dialog :value="reloadDialog" :persistent="!reloadError">
      <v-card v-if="!reloading" dark>
        <v-card-title>
          <h2 style="display: block; min-width: 100%">
            {{ $t('setting.setRootTitle') }}
          </h2>
          <div style="color: grey;">
            {{ rootLocation }}
          </div>
        </v-card-title>
        <v-card-text>
          <p>
            {{ $t('setting.setRootDescription') }}
          </p>
          <p>
            {{ $t('setting.setRootCause') }}
          </p>
        </v-card-text>
        <v-divider />
        <v-card-actions>
          <v-checkbox v-model="clearData" style="margin-left: 10px" persistent-hint :hint="$t('setting.cleanOldDataHint')"
                      :label="$t('setting.cleanOldData')" />
          <v-checkbox v-model="migrateData" persistent-hint :hint="$t('setting.copyOldToNewHint')"
                      :label="$t('setting.copyOldToNew')" />
        </v-card-actions>
        <v-card-actions>
          <v-btn flat large @click="doCancelApplyRoot">
            {{ $t('cancel') }}
          </v-btn>
          <v-spacer />
          <v-btn flat large @click="doApplyRoot(rootLocation, true)">
            {{ $t('setting.apply') }}
          </v-btn>
        </v-card-actions>
      </v-card>
      <v-card v-else dark>
        <v-card-title>
          <h2>
            {{ $t('setting.waitReload') }}
          </h2>
        </v-card-title>
        <v-spacer />
        <v-progress-circular v-if="!reloadError" indeterminate />
        <v-card-text v-else>
          {{ $t('setting.reloadFailed') }}:
          {{ reloadError }}
        </v-card-text>
        <v-card-actions v-if="reloadError">
          <v-btn>
            Ok
          </v-btn>
        </v-card-actions>
      </v-card>
    </v-dialog>
  </v-container>
</template>

<script>
import langIndex from 'static/locales/index.json';

export default {
  data() {
    return {
      rootLocation: this.$repo.state.root,

      clearData: false,
      migrateData: false,

      reloadDialog: false,
      reloading: false,
      reloadError: undefined,

      viewingUpdateDetail: false,
    };
  },
  computed: {
    selectedLang: {
      get() {
        return this.langs.find(l => l.value === this.$repo.state.setting.locale) || 'en';
      },
      set(v) { this.$repo.commit('locale', v); },
    },
    allowPrerelease: {
      get() { return this.$repo.state.setting.allowPrerelease; },
      set(v) { this.$repo.commit('allowPrerelease', v); },
    },
    autoInstallOnAppQuit: {
      get() { return this.$repo.state.setting.autoInstallOnAppQuit; },
      set(v) { this.$repo.commit('autoInstallOnAppQuit', v); },
    },
    autoDownload: {
      get() { return this.$repo.state.setting.autoDownload; },
      set(v) { this.$repo.commit('autoDownload', v); },
    },
    useBmclAPI: {
      get() { return this.$repo.state.setting.useBmclAPI; },
      set(v) { this.$repo.commit('useBmclApi', v); },
    },
    readyToUpdate() { return this.$repo.state.setting.readyToUpdate; },
    downloadingUpdate() { return this.$repo.state.setting.downloadingUpdate; },
    checkingUpdate() { return this.$repo.state.setting.checkingUpdate; },
    updateInfo() { return this.$repo.state.setting.updateInfo || {}; },
    langs() {
      return this.$repo.state.setting.locales.map(l => ({
        value: l,
        text: langIndex[l],
      })); 
    },
  },
  methods: {
    checkUpdate() {
      this.$repo.dispatch('checkUpdate').then((result) => {
        console.log(result);
      });
    },
    viewUpdateDetail() {
      this.viewingUpdateDetail = true;
    },
    showRootDir() {
      this.$electron.remote.shell.openItem(this.rootLocation);
    },
    browseRootDir() {
      this.$electron.remote.dialog.showOpenDialog({
        title: this.$t('setting.selectRootDirectory'),
        defaultPath: this.rootLocation,
        properties: ['openDirectory', 'createDirectory'],
      }, (paths, bookmarks) => {
        if (paths && paths.length !== 0) {
          this.rootLocation = paths[0];
          this.reloadDialog = true;
        }
      });
    },
    doCancelApplyRoot() {
      this.reloadDialog = false;
      this.rootLocation = this.$repo.state.root;
    },
    doApplyRoot(defer) {
      this.reloading = true;
      this.$electron.ipcRenderer.once('root', (error) => {
        this.reloading = false;
        if (error) {
          this.reloadError = error;
        } else {
          this.reloadDialog = false;
        }
      });
      this.$electron.ipcRenderer.send('root', { path: this.rootLocation, migrate: this.migrateData, clear: this.clearData });
    },
  },
};
</script>

<style>
</style>
