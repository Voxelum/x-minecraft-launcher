<template>
  <v-container fluid grid-list-md fill-height>
    <speed-dial
      :security="security"
      :disabled="pending"
      :upload="() => isImportSkinDialogShown = true"
      :save="exportSkin"
      :load="loadSkin"
    />

    <v-fab-transition>
      <v-btn
        v-show="modified"
        color="secondary"
        fab
        small
        absolute
        style="bottom: 100px; right: 55px; z-index: 2;"
        :disabled="pending"
        @click="reset"
      >
        <v-icon>clear</v-icon>
      </v-btn>
    </v-fab-transition>
    <v-fab-transition>
      <v-btn
        v-show="modified"
        color="secondary"
        fab
        small
        absolute
        style="bottom: 100px; right: 177px; z-index: 2;"
        :disabled="pending"
        @click="save"
      >
        <v-icon>check</v-icon>
      </v-btn>
    </v-fab-transition>

    <v-layout row fill-height>
      <v-flex grow>
        <v-layout column fill-height>
          <v-flex d-flex grow>
            <v-layout column justify-start>
              <v-flex
                tag="h1"
                class="white--text"
                xs1
                style="margin-bottom: 10px; padding: 6px; 8px;"
              >
                <span class="headline">{{ $t('user.info') }}</span>
              </v-flex>
              <v-flex xs1 style="padding-left: 5px;">
                <v-text-field
                  hide-details
                  readonly
                  color="primary"
                  dark
                  prepend-inner-icon="person"
                  append-icon="file_copy"
                  :label="$t('user.name')"
                  :value="name"
                  @click:append="copyToClipBoard(name)"
                />
              </v-flex>
              <v-flex xs1 style="padding-left: 5px;">
                <v-text-field
                  hide-details
                  readonly
                  dark
                  append-icon="file_copy"
                  color="primary"
                  prepend-inner-icon="vpn_key"
                  :label="$t('user.accessToken')"
                  :value="accessToken"
                  @click:append="copyToClipBoard(accessToken)"
                />
              </v-flex>
              <v-flex xs1 style="padding-left: 5px;">
                <v-text-field
                  hide-details
                  readonly
                  append-icon="add"
                  prepend-inner-icon="security"
                  :label="$t('user.authService')"
                  :value="authService"
                  color="primary"
                  @click:append="isUserServicesDialogShown = true"
                />
              </v-flex>
              <v-flex xs1 style="padding-left: 5px;">
                <v-text-field
                  hide-details
                  readonly
                  color="primary"
                  prepend-inner-icon="assignment_ind"
                  append-icon="add"
                  :label="$t('user.profileService')"
                  :value="profileService"
                  @click:append="isUserServicesDialogShown = true"
                />
              </v-flex>

              <v-flex xs1 style="padding-left: 5px;">
                <v-select
                  v-model="slim"
                  hide-details
                  prepend-inner-icon="accessibility"
                  :label="$t('user.skinSlim')"
                  :items="[{text:'Alex', value:true}, {text:'Steve', value:false}]"
                  item-text="text"
                  item-value="value"
                  color="primary"
                  dark
                />
              </v-flex>
            </v-layout>
          </v-flex>

          <v-flex d-flex xs12>
            <v-alert
              :value="!security"
              style="cursor: pointer;"
              @click="isChallengesDialogShown = true"
            >{{ $t('user.insecureClient') }}</v-alert>
          </v-flex>

          <v-flex d-flex shrink>
            <v-layout wrap>
              <v-flex d-flex xs6>
                <v-btn block :disabled="pending" color="secondary" @click="refresh">
                  <v-icon left>refresh</v-icon>
                  {{ $t('user.refreshSkin') }}
                </v-btn>
              </v-flex>
              <v-flex d-flex xs6>
                <v-btn block :disabled="pending" color="secondary" @click="refreshAccount">
                  <v-icon left>refresh</v-icon>
                  {{ $t('user.refreshAccount') }}
                </v-btn>
              </v-flex>
            </v-layout>
          </v-flex>
          <v-flex d-flex shrink>
            <v-layout wrap>
              <v-flex d-flex xs6>
                <v-btn block color="secondary" @click="toggleSwitchUser">
                  <v-icon left dark>compare_arrows</v-icon>
                  {{ $t('user.account.switch') }}
                </v-btn>
              </v-flex>
              <v-flex d-flex xs6>
                <v-btn block dark :disabled="offline" color="red" @click="logout">
                  <v-icon left dark>exit_to_app</v-icon>
                  {{ $t('user.logout') }}
                </v-btn>
              </v-flex>
            </v-layout>
          </v-flex>
        </v-layout>
      </v-flex>
      <v-flex shrink>
        <v-layout justify-center align-center fill-height>
          <v-flex style="z-index: 1">
            <skin-view
              :href="url"
              :slim="slim"
              :rotate="false"
              @drop.prevent="dropSkin"
              @dragover.prevent
            />
            <!-- <v-progress-circular v-if="pending" color="white" indeterminate :size="90" style="position: absolute; top: 30vh; right: 13vh;" /> -->
          </v-flex>
        </v-layout>
      </v-flex>
    </v-layout>
    <challenges-dialog v-model="isChallengesDialogShown" />
    <import-skin-url-dialog v-model="isImportSkinDialogShown" :update="updateSkinUrl" />
    <user-services-dialog v-model="isUserServicesDialogShown" />
  </v-container>
</template>

<script lang=ts>
import { reactive, toRefs, computed, defineComponent } from '@vue/composition-api';
import {
  useCurrentUser,
  useI18n,
  useCurrentUserSkin,
  useNativeDialog,
  useClipboard,
} from '@/hooks';
import { useNotifier, useLoginDialog } from '../hooks';
import ChallengesDialog from './UserPageChallengesDialog.vue';
import ImportSkinUrlDialog from './UserPageImportSkinUrlDialog.vue';
import UserServicesDialog from './UserPageUserServicesDialog.vue';
import SpeedDial from './UserPageSpeedDial.vue';

export default defineComponent({
  components: {
    ChallengesDialog,
    UserServicesDialog,
    ImportSkinUrlDialog,
    SpeedDial,
  },
  setup() {
    const { $t } = useI18n();
    const clipboard = useClipboard();
    const {
      security,
      offline,
      name,
      accessToken,
      authService,
      profileService,
      refreshStatus: refreshAccount,
      logout,
    } = useCurrentUser();
    const { url, slim, refreshing, refresh, save, exportTo, loading, modified, reset } = useCurrentUserSkin();
    const { showOpenDialog, showSaveDialog } = useNativeDialog();
    const { show: showLoginDialog, isSwitchingUser } = useLoginDialog();
    const { notify, watcher } = useNotifier();
    const pending = computed(() => refreshing.value || loading.value);

    const data = reactive({
      isImportSkinDialogShown: false,
      isChallengesDialogShown: false,
      isUserServicesDialogShown: false,
    });

    function updateSkinUrl(u: string) {
      url.value = u;
    }
    async function loadSkin() {
      const { filePaths } = await showOpenDialog({ title: $t('user.openSkinFile'), filters: [{ extensions: ['png'], name: 'PNG Images' }] });
      if (filePaths && filePaths[0]) {
        url.value = `file://${filePaths[0]}`;
      }
    }
    async function exportSkin() {
      const { filePath } = await showSaveDialog({
        title: $t('user.skinSaveTitle'),
        defaultPath: `${name.value}.png`,
        filters: [{ extensions: ['png'], name: 'PNG Images' }],
      });
      if (filePath) {
        exportTo({ path: filePath, url: url.value });
      }
    }
    async function dropSkin(e: DragEvent) {
      if (e.dataTransfer) {
        const length = e.dataTransfer.files.length;
        if (length > 0) {
          url.value = `file://${e.dataTransfer!.files[0].path}`;
        }
      }
    }

    return {
      ...toRefs(data),
      offline,
      name,
      security,
      logout,
      refreshAccount,
      accessToken,
      authService,
      profileService,

      url,
      slim,
      modified,
      reset,
      updateSkinUrl,
      refresh: watcher(() => refresh(true), () => $t('user.refreshSkinSuccess'), () => $t('user.refreshSkinFail')),
      save: watcher(save, () => $t('user.skin.upload.success'), () => $t('user.skin.upload.fail')),
      loadSkin,
      exportSkin,
      dropSkin,

      pending,

      toggleSwitchUser() {
        isSwitchingUser.value = true;
        showLoginDialog();
      },
      copyToClipBoard(text: string) {
        notify('success', $t('copy.success'));
        clipboard.clear();
        clipboard.writeText(text);
      },
    };
  },
});
</script>

<style>
.my-slider-x-transition-enter-active {
  transition: 0.3 cubic-bezier(0.25, 0.8, 0.5, 1);
}
.my-slider-x-transition-leave-active {
  transition: 0.3 cubic-bezier(0.25, 0.8, 0.5, 1);
}
.my-slider-x-transition-move {
  transition: transform 0.6s;
}
.my-slider-x-transition-enter {
  transform: translateX(100%);
}
.my-slider-x-transition-leave-to {
  transform: translateX(100%);
}
</style>
