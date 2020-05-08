<template>
  <v-container grid-list-md fluid style="z-index: 2">
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
              <v-select v-model="selectedLocale"
                        style="max-width: 185px;" 
                        dark 
                        hide-details 
                        :items="locales" />
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
          <v-subheader>{{ $t('setting.appearance') }}</v-subheader>
          <v-list-tile avatar>
            <v-list-tile-action>
              <v-checkbox v-model="showParticle" />
            </v-list-tile-action>
            <v-list-tile-content>
              <v-list-tile-title> {{ $t('setting.showParticle') }} </v-list-tile-title>
              <v-list-tile-sub-title> {{ $t('setting.showParticleDescription') }} </v-list-tile-sub-title>
            </v-list-tile-content>
          </v-list-tile>
          <v-list-tile>
            <v-list-tile-content>
              <v-list-tile-title> {{ $t('setting.particleMode') }} </v-list-tile-title>
              <v-list-tile-sub-title> {{ $t('setting.particleModeDescription') }} </v-list-tile-sub-title>
            </v-list-tile-content>
            <v-list-tile-action>
              <v-select v-model="particleMode" :items="particleModes" />
            </v-list-tile-action>
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

    <update-info-dialog v-model="viewingUpdateDetail" />
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
          <v-btn flat large @click="doApplyRoot()">
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
            {{ $t('ok') }}
          </v-btn>
        </v-card-actions>
      </v-card>
    </v-dialog>
  </v-container>
</template>

<script lang=ts>
import { defineComponent, reactive, ref, toRefs, watch, Ref } from '@vue/composition-api';
import { useStore, useI18n, useParticle, useSettings, useIpc, useNativeDialog, useService } from '@/hooks';
import localMapping from '@/assets/locales/index.json';

import UpdateInfoDialog from './SettingPageUpdateInfoDialog.vue';

export default defineComponent({
  components: { UpdateInfoDialog },
  setup() {
    const ipcRenderer = useIpc();
    const dialog = useNativeDialog();
    const { showParticle, particleMode } = useParticle();
    const { state } = useStore();
    const settings = useSettings();
    const { $t } = useI18n();
    const { openDirectory } = useService('BaseService');
    const data = reactive({
      rootLocation: state.root,

      clearData: false,
      migrateData: false,

      reloadDialog: false,
      reloading: false,
      reloadError: undefined as undefined | Error,

      viewingUpdateDetail: false,
    });

    const particleModes: Ref<{ value: string; text: string }[]> = ref(['push', 'remove', 'repulse', 'bubble'].map(t => ({ value: t, text: $t(`setting.particleMode.${t}`) })));
    watch(settings.selectedLocale, () => {
      particleModes.value = ['push', 'remove', 'repulse', 'bubble'].map(t => ({ value: t, text: $t(`setting.particleMode.${t}`) }));
    });
    return {
      ...toRefs(data),
      ...settings,
      locales: settings.locales.value.map(l => ({ text: localMapping[l] ?? l, value: l })),
      showParticle,
      particleMode,
      particleModes,
      viewUpdateDetail() {
        data.viewingUpdateDetail = true;
      },
      showRootDir() {
        openDirectory(data.rootLocation);
      },
      async browseRootDir() {
        const { filePaths } = await dialog.showOpenDialog({
          title: $t('setting.selectRootDirectory'),
          defaultPath: data.rootLocation,
          properties: ['openDirectory', 'createDirectory'],
        });
        if (filePaths && filePaths.length !== 0) {
          data.rootLocation = filePaths[0];
          data.reloadDialog = true;
        }
      },
      doCancelApplyRoot() {
        data.reloadDialog = false;
        data.rootLocation = state.root;
      },
      doApplyRoot() {
        data.reloading = true;
        ipcRenderer.once('root', (error) => {
          data.reloading = false;
          if (error) {
            // data.reloadError = error;
          } else {
            data.reloadDialog = false;
          }
        });
        ipcRenderer.send('root', { path: data.rootLocation, migrate: data.migrateData, clear: data.clearData });
      },
    };
  },
});
</script>
