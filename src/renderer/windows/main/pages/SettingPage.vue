<template>
  <v-container
    grid-list-md
    fluid
    style="z-index: 2; overflow: auto;"
  >
    <v-layout
      wrap
      style="padding: 6px; 8px; max-height: 95vh"
      fill-height
    >
      <v-flex
        d-flex
        xs12
        tag="h1"
        style="margin-bottom: 20px; "
        class="white--text"
      >
        <span class="headline">{{ $tc('setting.name', 2) }}</span>
      </v-flex>
      <v-flex
        d-flex
        xs12
      >
        <v-list
          three-line
          subheader
          style="background: transparent; width: 100%"
        >
          <v-subheader>{{ $t('setting.general') }}</v-subheader>
          <v-list-tile>
            <v-list-tile-content>
              <v-list-tile-title>{{ $t('setting.language') }}</v-list-tile-title>
              <v-list-tile-sub-title>{{ $t('setting.languageDescription') }}</v-list-tile-sub-title>
            </v-list-tile-content>
            <v-list-tile-action>
              <v-select
                v-model="selectedLocale"
                style="max-width: 185px;"
                dark
                hide-details
                :items="locales"
              />
            </v-list-tile-action>
          </v-list-tile>
          <v-list-tile>
            <v-list-tile-content>
              <v-list-tile-title>{{ $t('setting.location') }}</v-list-tile-title>
              <v-list-tile-sub-title>{{ rootLocation }}</v-list-tile-sub-title>
            </v-list-tile-content>
            <v-list-tile-action>
              <v-btn
                outline
                flat
                style="margin-right: 10px;"
                @click="browseRootDir"
              >
                {{ $t('setting.browseRoot') }}
              </v-btn>
            </v-list-tile-action>
            <v-list-tile-action>
              <v-btn
                outline
                flat
                @click="showRootDir"
              >
                {{ $t('setting.showRoot') }}
              </v-btn>
            </v-list-tile-action>
          </v-list-tile>
          <v-list-tile>
            <v-list-tile-content>
              <v-list-tile-title>{{ $t('setting.useBmclAPI') }}</v-list-tile-title>
              <v-list-tile-sub-title>{{ $t('setting.useBmclAPIDescription') }}</v-list-tile-sub-title>
            </v-list-tile-content>
            <v-list-tile-action>
              <v-select
                v-model="apiSetsPreference"
                style="max-width: 185px;"
                dark
                hide-details
                :items="apiSets"
                item-text="name"
              />
            </v-list-tile-action>
          </v-list-tile>
        </v-list>
      </v-flex>
      <v-divider dark />
      <v-flex style="background: transparent">
        <v-list
          three-line
          subheader
          style="background: transparent"
        >
          <v-subheader>{{ $t('setting.update') }}</v-subheader>
          <v-list-tile avatar>
            <v-list-tile-action>
              <v-btn
                icon
                :loading="checkingUpdate"
                @click="checkUpdate"
              >
                <v-icon>refresh</v-icon>
              </v-btn>
            </v-list-tile-action>
            <v-list-tile-content>
              <v-list-tile-title>{{ $t('setting.latestVersion') }}</v-list-tile-title>
              <v-list-tile-sub-title>{{ version }} build {{ build }} {{ updateInfo.version ? `-> ${updateInfo.version}` : '' }}</v-list-tile-sub-title>
            </v-list-tile-content>
            <v-list-tile-action>
              <v-btn
                :loading="checkingUpdate"
                :disabled="updateStatus === 'none'"
                flat
                @click="viewUpdateDetail"
              >
                {{ updateStatus === 'none' ? $t('setting.alreadyLatest') : updateStatus === 'pending' ? $t('setting.updateToThisVersion') : $t('setting.installAndQuit') }}
              </v-btn>
            </v-list-tile-action>
          </v-list-tile>
          <!-- <v-list-tile avatar>
            <v-list-tile-action>
              <v-checkbox v-model="autoInstallOnAppQuit" />
            </v-list-tile-action>
            <v-list-tile-content>
              <v-list-tile-title>{{ $t('setting.autoInstallOnAppQuit') }}</v-list-tile-title>
              <v-list-tile-sub-title>{{ $t('setting.autoInstallOnAppQuitDescription') }}</v-list-tile-sub-title>
            </v-list-tile-content>
          </v-list-tile>
          <v-list-tile avatar>
            <v-list-tile-action>
              <v-checkbox
                v-model="autoDownload"
                dark
              />
            </v-list-tile-action>
            <v-list-tile-content>
              <v-list-tile-title>{{ $t('setting.autoDownload') }}</v-list-tile-title>
              <v-list-tile-sub-title>{{ $t('setting.autoDownloadDescription') }}</v-list-tile-sub-title>
            </v-list-tile-content>
          </v-list-tile>
          <v-list-tile avatar>
            <v-list-tile-action>
              <v-checkbox v-model="allowPrerelease" />
            </v-list-tile-action>
            <v-list-tile-content>
              <v-list-tile-title>{{ $t('setting.allowPrerelease') }}</v-list-tile-title>
              <v-list-tile-sub-title>{{ $t('setting.allowPrereleaseDescription') }}</v-list-tile-sub-title>
            </v-list-tile-content>
          </v-list-tile>-->
          <v-subheader>{{ $t('setting.appearance') }}</v-subheader>
          <v-list-tile avatar>
            <v-list-tile-action>
              <v-checkbox v-model="blurMainBody" />
            </v-list-tile-action>
            <v-list-tile-content>
              <v-list-tile-title>{{ $t('setting.blurMainBody') }}</v-list-tile-title>
              <v-list-tile-sub-title>{{ $t('setting.blurMainBodyDescription') }}</v-list-tile-sub-title>
            </v-list-tile-content>
          </v-list-tile>
          <v-list-tile avatar>
            <v-list-tile-action>
              <v-checkbox v-model="showParticle" />
            </v-list-tile-action>
            <v-list-tile-content>
              <v-list-tile-title>{{ $t('setting.showParticle') }}</v-list-tile-title>
              <v-list-tile-sub-title>{{ $t('setting.showParticleDescription') }}</v-list-tile-sub-title>
            </v-list-tile-content>
          </v-list-tile>
          <v-list-tile>
            <v-list-tile-content>
              <v-list-tile-title>{{ $t('setting.particleMode') }}</v-list-tile-title>
              <v-list-tile-sub-title>{{ $t('setting.particleModeDescription') }}</v-list-tile-sub-title>
            </v-list-tile-content>
            <v-list-tile-action>
              <v-select
                v-model="particleMode"
                :items="particleModes"
              />
            </v-list-tile-action>
          </v-list-tile>
        </v-list>
      </v-flex>
    </v-layout>

    <update-info-dialog v-model="viewingUpdateDetail" />
    <v-dialog
      :value="migrateDialog"
      persistent
    >
      <v-card
        v-if="migrateState === 0"
        dark
      >
        <v-card-title>
          <h2 style="display: block; min-width: 100%">{{ $t('setting.setRootTitle') }}</h2>
          <v-text-field
            :value="rootLocation"
            readonly
            hide-details
          ></v-text-field>
        </v-card-title>
        <v-card-text>
          <p>{{ $t('setting.setRootDescription') }}</p>
          <p>{{ $t('setting.setRootCause') }}</p>
        </v-card-text>
        <v-divider />
        <v-card-actions>
          <v-btn
            flat
            large
            @click="doCancelApplyRoot"
          >
            {{ $t('cancel') }}
          </v-btn>
          <v-spacer />
          <v-btn
            flat
            large
            @click="doApplyRoot()"
          >
            {{ $t('setting.apply') }}
          </v-btn>
        </v-card-actions>
      </v-card>
      <v-card
        v-else-if="migrateState === 1"
        dark
      >
        <v-card-title>
          <h2>{{ $t('setting.waitReload') }}</h2>
        </v-card-title>
        <v-spacer />
        <div style="display: flex;width: 100; justify-content: center">
          <v-progress-circular :size="100" color="white" indeterminate />
        </div>
      </v-card>
      <v-card
        v-else
        dark
      >
        <v-card-title>
          <h2 v-if="migrateError">{{ $t('setting.migrateFailed') }}</h2>
          <h2 v-else-if="!cleaningMigration">{{ $t('setting.migrateSuccess') }}</h2>
          <h2 v-else>{{ $t('setting.postMigrating') }}</h2>
        </v-card-title>
        <v-spacer />
        <v-card-text v-if="migrateError">{{ migrateError }}</v-card-text>
        <v-divider />
        <v-card-actions v-if="!migrateError">
          <v-checkbox
            v-model="clearData"
            style="margin-left: 10px"
            persistent-hint
            :hint="$t('setting.cleanOldDataHint')"
            :label="$t('setting.cleanOldData')"
          />
        </v-card-actions>
        <v-card-actions>
          <v-spacer />
          <v-btn
            flat
            color="primary"
            :loading="cleaningMigration"
            :disabled="cleaningMigration"
            @click="postMigrate"
          >
            {{ $t('setting.migrateDone') }}
          </v-btn>
        </v-card-actions>
      </v-card>
    </v-dialog>
  </v-container>
</template>

<script lang=ts>
import { defineComponent, reactive, ref, toRefs, watch, Ref } from '@vue/composition-api';
import { useStore, useI18n, useParticle, useSettings, useNativeDialog, useService, useLauncherVersion, useBackgroundBlur } from '@/hooks';
import localMapping from '@/assets/locales/index.json';

import UpdateInfoDialog from './SettingPageUpdateInfoDialog.vue';

export default defineComponent({
  components: { UpdateInfoDialog },
  setup() {
    const dialog = useNativeDialog();
    const { showParticle, particleMode } = useParticle();
    const { blurMainBody } = useBackgroundBlur();
    const { migrate, postMigrate } = useService('BaseService');
    const { state } = useStore();
    const settings = useSettings();
    const { $t } = useI18n();
    const { openDirectory } = useService('BaseService');
    const data = reactive({
      rootLocation: state.root,

      clearData: false,
      migrateData: false,

      migrateDialog: false,

      migrateState: 0,
      cleaningMigration: false,
      migrateError: undefined as undefined | Error,

      viewingUpdateDetail: false,
    });

    const { version, build } = useLauncherVersion();
    const particleModes: Ref<{ value: string; text: string }[]> = ref(['push', 'remove', 'repulse', 'bubble'].map(t => ({ value: t, text: $t(`setting.particleMode.${t}`) })));
    watch(settings.selectedLocale, () => {
      particleModes.value = ['push', 'remove', 'repulse', 'bubble'].map(t => ({ value: t, text: $t(`setting.particleMode.${t}`) }));
    });
    return {
      ...toRefs(data),
      ...settings,
      version,
      build,
      locales: settings.locales.value.map(l => ({ text: localMapping[l] ?? l, value: l })),
      showParticle,
      particleMode,
      blurMainBody,
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
          data.migrateDialog = true;
        }
      },
      doCancelApplyRoot() {
        data.migrateDialog = false;
        data.rootLocation = state.root;
      },
      doApplyRoot() {
        data.migrateState = 1;
        migrate({ destination: data.rootLocation })
          .catch((e) => {
            data.migrateError = e;
          })
          .finally(() => {
            data.migrateState = 2;
          });
      },
      postMigrate() {
        if (data.clearData) {
          data.cleaningMigration = true;
          postMigrate().finally(() => {
            data.migrateDialog = false;
            data.cleaningMigration = false;
          });
        } else {
          data.migrateDialog = false;
        }
      },
    };
  },
});
</script>
