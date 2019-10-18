<template>
  <v-container fluid grid-list-md fill-height>
    <v-tooltip :close-delay="0" left>
      <template v-slot:activator="{ on }">
        <v-speed-dial v-if="security" v-model="fab"
                      style="position:absolute; z-index: 2; bottom: 80px; right: 100px;" direction="top" :open-on-hover="true">
          <template v-slot:activator>
            <v-btn v-model="fab" color="secondary" :disabled="pending" fab @click="loadSkin" v-on="on" @mouseenter="enterEditBtn">
              <v-icon>edit</v-icon>
            </v-btn>
          </template>
          <v-btn :disabled="pending" color="secondary" fab small v-on="on" @click="openUploadSkinDialog" @mouseenter="enterLinkBtn">
            <v-icon>link</v-icon>
          </v-btn>
          <v-btn :disabled="pending" color="secondary" fab small v-on="on" @click="saveSkin" @mouseenter="enterSaveBtn">
            <v-icon>save</v-icon>
          </v-btn>
        </v-speed-dial>
      </template>
      {{ hoverTextOnEdit }}
    </v-tooltip>

    <v-fab-transition>
      <v-btn v-show="modified" 
             fab small absolute style="bottom: 100px; right: 45px; z-index: 2;"
             :disabled="pending" 
             @click="reset">
        <v-icon>clear</v-icon>
      </v-btn>
    </v-fab-transition>
    <v-fab-transition>
      <v-btn v-show="modified" 
             fab small absolute style="bottom: 100px; right: 157px; z-index: 2;"
             :disabled="pending" 
             @click="uploadSkin">
        <v-icon>check</v-icon>
      </v-btn>
    </v-fab-transition>

    <v-layout row fill-height>
      <v-flex grow>
        <v-layout column fill-height>
          <v-flex d-flex grow>
            <v-layout column justify-start>
              <v-flex tag="h1" class="white--text" xs1 style="margin-bottom: 10px; padding: 6px; 8px;">
                <span class="headline">{{ $t('user.info') }}</span>
              </v-flex>
              <v-flex xs1 style="padding-left: 5px;">
                <v-text-field hide-details 
                              readonly 
                              color="primary"
                              dark 
                              append-icon="file_copy" 
                              :label="$t('user.name')" 
                              :value="name"
                              @click:append="copyToClipBoard(name)" />
              </v-flex>
              <v-flex xs1 style="padding-left: 5px;">
                <v-text-field hide-details 
                              readonly
                              dark
                              append-icon="file_copy" 
                              color="primary" 
                              :label="$t('user.accessToken')" 
                              :value="accessToken"
                              @click:append="copyToClipBoard(accessToken)" />
              </v-flex>
              <v-flex xs1 style="padding-left: 5px;">
                <v-text-field hide-details 
                              readonly 
                              append-icon="add" 
                              :label="$t('user.authService')" 
                              :value="authService"
                              color="primary" 
                              @click:append="openUserServiceDialog()" />
              </v-flex>
              <v-flex xs1 style="padding-left: 5px;">
                <v-text-field hide-details 
                              readonly
                              color="primary" 
                              append-icon="add" 
                              :label="$t('user.profileService')" 
                              :value="profileService"
                              @click:append="openUserServiceDialog()" />
              </v-flex>

              <v-flex xs1 style="padding-left: 5px;">
                <v-select v-model="skinSlim" hide-details :label="$t('user.skinSlim')"
                          :items="[{text:'Alex', value:true}, {text:'Steve', value:false}]" item-text="text" item-value="value" color="primary" dark />
              </v-flex>
            </v-layout>
          </v-flex>

          <v-flex d-flex xs12>
            <v-alert :value="!security" style="cursor: pointer;" @click="openChallengeDialog()">
              {{ $t('user.insecureClient') }}
            </v-alert>
          </v-flex>

          <v-flex d-flex shrink>
            <v-layout wrap>
              <v-flex d-flex xs6>
                <v-btn block :disabled="pending" color="secondary" @click="refreshSkin()">
                  <v-icon left>
                    refresh
                  </v-icon>
                  {{ $t('user.refreshSkin') }}
                </v-btn>
              </v-flex>
              <v-flex d-flex xs6>
                <v-btn block :disabled="pending" color="secondary" @click="refreshAccount()">
                  <v-icon left>
                    refresh
                  </v-icon>
                  {{ $t('user.refreshAccount') }}
                </v-btn>
              </v-flex>
            </v-layout>
          </v-flex>
          <v-flex d-flex shrink>
            <v-layout wrap>
              <v-flex d-flex xs6>
                <v-btn block color="secondary" @click="toggleSwitchUser"> 
                  <v-icon left dark>
                    compare_arrows
                  </v-icon>
                  {{ $t('user.account.switch') }}
                </v-btn>
              </v-flex>
              <v-flex d-flex xs6>
                <v-btn block dark :disabled="offline" color="red" @click="logout()">
                  <v-icon left dark>
                    exit_to_app
                  </v-icon>
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
            <skin-view :href="skinUrl" :slim="skinSlim" :rotate="false" @drop.prevent="onDropSkin" @dragover.prevent />
            <!-- <v-progress-circular v-if="pending" color="white" indeterminate :size="90" style="position: absolute; top: 30vh; right: 13vh;" /> -->
          </v-flex>
        </v-layout>
      </v-flex>
    </v-layout>
  </v-container>
</template>

<script>
import { useCurrentUser, useNotifier, useI18n, useActions, useCurrentUserSkin, useDialog, useNativeDialog } from '@/hooks';
import { reactive, toRefs, onMounted, computed } from '@vue/composition-api';
import { clipboard } from 'electron';

export default {
  setup() {
    const { t } = useI18n();
    const {
      security,
      offline,
      selectedGameProfile,
      name,
      accessToken,
      authService,
      profileService,
    } = useCurrentUser();
    const { url, slim, refreshing: refreshingSkin } = useCurrentUserSkin();
    const { showOpenDialog, showSaveDialog } = useNativeDialog();
    const { showDialog: showChallengeDialog } = useDialog('challenge');
    const { showDialog, onDialogClosed: onSkinImportDialogClosed } = useDialog('skin-import');
    const { showDialog: showLoginDialog } = useDialog('login');
    const { showDialog: showUserServiceDialog } = useDialog('user-service');
    const { notify } = useNotifier();

    const {
      logout,
      refreshInfo: refreshAccount,
      refreshSkin,
      parseSkin,
      uploadSkin,
      saveSkin,
      switchUserProfile,
    } = useActions('logout', 'refreshInfo', 'refreshSkin', 'parseSkin', 'uploadSkin', 'saveSkin', 'switchUserProfile');
    const data = reactive({
      fab: false,

      hoverTextOnEdit: '',
      skinUrl: '',
      skinSlim: false,

      parsingSkin: false,
      uploadingSkin: false,
    });
    const modified = computed(() => {
      if (offline.value) return false;
      return data.skinUrl !== url.value || data.skinSlim !== slim.value;
    });

    const pending = computed(() => refreshingSkin.value || data.uploadingSkin || data.parsingSkin);

    function reset() {
      if (modified.value) {
        data.skinUrl = url.value;
        data.skinSlim = slim.value;
      }
    }
    async function loadSkin() {
      // await this.$nextTick();
      showOpenDialog({ title: t('user.openSkinFile'), filters: [{ extensions: ['png'], name: 'PNG Images' }] }, (filename, bookmark) => {
        if (filename && filename[0]) {
          parseSkin(filename[0]).then((skin) => {
            data.skinUrl = skin;
          }, (e) => {
            // this.$notify('error', this.$t('user.skinParseFailed', e));
          });
        }
      });
    }
    onSkinImportDialogClosed((s) => {
      data.skinUrl = s;
    });
    function openUploadSkinDialog() {
      showDialog();
    }
    function switchUser(profile) {
      switchUserProfile({
        profileId: profile.id,
        userId: profile.userId,
      });
    }
    onMounted(() => {
      reset();
    });

    return {
      ...toRefs(data),
      security,
      offline,
      modified,
      name,
      accessToken,
      authService,
      profileService,
      pending,

      logout,
      refreshAccount,
      loadSkin,
      reset,
      openUploadSkinDialog,
      switchUser,

      openUserServiceDialog: showUserServiceDialog,
      openChallengeDialog: showChallengeDialog,
      refreshSkin() {
        refreshSkin().then(() => {
          // this.$notify('info', this.$t('user.refreshSkinSuccess'));
        }, (e) => {
          // this.$notify('error', this.$t('user.refreshSkinFail', e));
        }).finally(() => {
          reset();
        });
      },
      async uploadSkin() {
        if (offline.value) {
          console.warn('Cannot update skin during offline mode');
        } else {
          data.uploadingSkin = true;
          try {
            await uploadSkin({ data: data.skinUrl, slim: data.skinSlim });
            // this.$notify('error', this.$t('user.uploadSkinFail', e));
            await refreshSkin();
          } finally {
            data.uploadingSkin = false;
          }
        }
      },
      saveSkin() {
        showSaveDialog({
          title: t('user.skinSaveTitle'),
          defaultPath: `${name.value}.png`,
          filters: [{ extensions: ['png'], name: 'PNG Images' }]
        },
          (filename, bookmark) => {
            if (filename) {
              saveSkin({ path: filename, skin: { data: data.skinUrl, slim: data.skinSlim } });
            }
          });
      },
      enterEditBtn() {
        data.hoverTextOnEdit = t('user.skinImportFile');
      },
      enterLinkBtn() {
        data.hoverTextOnEdit = t('user.skinImportLink');
      },
      enterSaveBtn() {
        data.hoverTextOnEdit = t('user.skinSave');
      },
      toggleSwitchUser() {
        showLoginDialog('login', true);
      },
      onDropSkin(e) {
        const length = e.dataTransfer.files.length;
        if (length > 0) {
          console.log(`Detect drop import ${length} file(s).`);
          for (let i = 0; i < length; ++i) {
            parseSkin(e.dataTransfer.files[i].path).then((skin) => {
              data.skinUrl = skin;
            });
          }
        }
      },
      copyToClipBoard(text) {
        notify('success', t('copy.success'));
        clipboard.clear();
        clipboard.writeText(text);
      },
    };
  },
};
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
