<template>
  <v-container fluid grid-list-md fill-height>
    <v-tooltip :close-delay="0" left>
      <template v-slot:activator="{ on }">
        <v-speed-dial v-if="security" v-model="fab"
                      style="position:absolute; z-index: 2; bottom: 80px; right: 85px;" direction="top" :open-on-hover="true">
          <template v-slot:activator>
            <v-btn v-model="fab" :disabled="pending" fab @click="doLoadSkin" v-on="on" @mouseenter="enterEditBtn">
              <v-icon>edit</v-icon>
            </v-btn>
          </template>
          <v-btn :disabled="pending" fab small v-on="on" @click="importUrlDialog=true" @mouseenter="enterLinkBtn">
            <v-icon>link</v-icon>
          </v-btn>
          <v-btn :disabled="pending" fab small v-on="on" @click="doSaveSkin" @mouseenter="enterSaveBtn">
            <v-icon>save</v-icon>
          </v-btn>
        </v-speed-dial>
      </template>
      {{ hoverTextOnEdit }}
    </v-tooltip>

    <v-fab-transition>
      <v-btn v-show="modified" fab small absolute style="bottom: 100px; right: 45px; z-index: 2;"
             :disabled="pending" @click="doReset">
        <v-icon>clear</v-icon>
      </v-btn>
    </v-fab-transition>
    <v-fab-transition>
      <v-btn v-show="modified" fab small absolute style="bottom: 100px; right: 157px; z-index: 2;"
             :disabled="pending" @click="doUpload">
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
                <v-text-field hide-details :label="$t('user.name')" readonly :value="gameProfile.name" color="primary"
                              dark append-icon="file_copy" @click:append="$copy(gameProfile.name)" />
              </v-flex>
              <v-flex xs1 style="padding-left: 5px;">
                <v-text-field hide-details :label="$t('user.accessToken')" readonly :value="user.accessToken"
                              color="primary" dark append-icon="file_copy" @click:append="$copy(user.accessToken)" />
              </v-flex>
              <v-flex xs1 style="padding-left: 5px;">
                <v-select hide-details :label="$t('user.authService')" 
                          readonly 
                          dark prepend-inner-icon="add" 
                          :value="user.authService"
                          :items="authServices" color="primary" 
                          @click:prepend-inner="userServiceDialog=true" />
              </v-flex>
              <v-flex xs1 style="padding-left: 5px;">
                <v-select hide-details :label="$t('user.profileService')" 
                          readonly
                          :items="profileServices" :value="user.profileService"
                          color="primary" dark prepend-inner-icon="add" 
                          @click:prepend-inner="userServiceDialog=true" />
              </v-flex>

              <v-flex xs1 style="padding-left: 5px;">
                <v-select v-model="skinSlim" hide-details :label="$t('user.skinSlim')"
                          :items="[{text:'Alex', value:true}, {text:'Steve', value:false}]" item-text="text" item-value="value" color="primary" dark />
              </v-flex>
            </v-layout>
          </v-flex>

          <v-flex d-flex xs12>
            <v-alert :value="!security" style="cursor: pointer;" @click="securityDialog = true">
              {{ $t('user.insecureClient') }}
            </v-alert>
          </v-flex>

          <v-flex d-flex shrink>
            <v-layout wrap>
              <v-flex d-flex xs6>
                <v-btn block dark :disabled="pending" @click="refreshSkin">
                  <v-icon left dark>
                    refresh
                  </v-icon>
                  {{ $t('user.refreshSkin') }}
                </v-btn>
              </v-flex>
              <v-flex d-flex xs6>
                <v-btn block dark :disabled="pending" @click="refreshAccount">
                  <v-icon left dark>
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
                <v-btn block @click="toggleSwitchUser">
                  <v-icon left dark>
                    compare_arrows
                  </v-icon>
                  {{ $t('user.account.switch') }}
                </v-btn>
              </v-flex>
              <v-flex d-flex xs6>
                <v-btn block dark :disabled="offline" color="red" @click="doLogout">
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
          <v-flex style="z-index: 1;">
            <skin-view :href="skinData" :slim="skinSlim" :rotate="false" @drop="onDropSkin" @dragover="onDragOver" />
            <!-- <v-progress-circular v-if="pending" color="white" indeterminate :size="90" style="position: absolute; top: 30vh; right: 13vh;" /> -->
          </v-flex>
        </v-layout>
      </v-flex>
    </v-layout>

    <dialog-user-services v-model="userServiceDialog" />
    <dialog-challenges v-model="securityDialog" />
    <v-dialog v-model="importUrlDialog" width="400">
      <v-card dark>
        <v-container fluid grid-list-md>
          <v-layout row wrap>
            <v-flex d-flex xs12>
              <v-text-field v-model="skinUrl" validate-on-blur :rules="skinUrlFormat" :label="$t('user.skinPlaceUrlHere')"
                            clearable @input="updateSkinUrl" />
            </v-flex>
            <v-flex d-flex xs12>
              <v-btn :disabled="skinUrlError" @click="doLoadSkinFromUrl">
                {{ $t('user.skinImport') }}
              </v-btn>
            </v-flex>
          </v-layout>
        </v-container>
      </v-card>
    </v-dialog>
  </v-container>
</template>

<script>

// https://stackoverflow.com/questions/5717093/check-if-a-javascript-string-is-a-url
const URL_PATTERN = new RegExp('^(https?:\\/\\/)?' // protocol
  + '((([a-z\\d]([a-z\\d-]*[a-z\\d])*)\\.)+[a-z]{2,}|' // domain name
  + '((\\d{1,3}\\.){3}\\d{1,3}))' // OR ip (v4) address
  + '(\\:\\d+)?(\\/[-a-z\\d%_.~+]*)*' // port and path
  + '(\\?[;&a-z\\d%_.~+=-]*)?' // query string
  + '(\\#[-a-z\\d_]*)?$', 'i'); // fragment locator

export default {
  data() {
    return {
      fab: false,

      hoverTextOnEdit: '',
      skinUrlError: true,
      skinUrlFormat: [
        v => !!v || this.$t('user.skinUrlNotEmpty'),
        v => !!URL_PATTERN.test(v) || this.$t('user.skinUrlNotValid'),
      ],
      skinUrl: '',
      skinData: '',
      skinSlim: false,

      securityDialog: false,
      userServiceDialog: false,
      importUrlDialog: false,

      parsingSkin: false,
      uploadingSkin: false,
    };
  },
  computed: {
    user() { return this.$repo.getters.selectedUser; },
    gameProfile() { return this.$repo.getters.selectedGameProfile; },
    gameProfiles() { return this.$repo.getters.avaiableGameProfiles; },

    security() { return this.user.authServices === 'mojang' ? this.$repo.state.user.security : true; },
    offline() { return this.$repo.getters.offline; },
    refreshingSkin() { return this.$repo.state.user.refreshingSkin; },
    pending() { return this.refreshingSkin || this.uploadingSkin || this.parsingSkin; },

    authServices() { return this.$repo.getters.authServices; },
    profileServices() { return this.$repo.getters.profileServices; },

    modified() {
      if (this.offline) return false;
      const skin = this.gameProfile.textures.SKIN;
      const skinSlim = skin.metadata ? skin.metadata.model === 'slim' : false;
      return this.skinData !== skin.url || this.skinSlim !== skinSlim;
    },
  },
  mounted() {
    this.doReset();
  },
  methods: {
    doLogout() {
      return this.$repo.dispatch('logout');
    },
    refreshSkin() {
      this.$repo.dispatch('refreshSkin').then(() => {
        this.$notify('info', this.$t('user.refreshSkinSuccess'));
      }, (e) => {
        this.$notify('error', this.$t('user.refreshSkinFail', e));
      }).finally(() => {
        this.doReset();
      });
    },
    refreshAccount() {
      this.$repo.dispatch('refreshInfo');
    },
    onDragOver(e) {
      e.preventDefault();
      return false;
    },
    onDropSkin(e) {
      e.preventDefault();

      const length = e.dataTransfer.files.length;
      if (length > 0) {
        console.log(`Detect drop import ${length} file(s).`);
        for (let i = 0; i < length; ++i) {
          // TOOD: use resource module to manage skin
          this.$repo.dispatch('parseSkin', e.dataTransfer.files[i].path).then((skin) => {
            if (skin) {
              this.skinData = skin;
            }
          });
        }
      }
    },
    doLoadSkinFromUrl() {
      this.importUrlDialog = false;

      this.parsingSkin = true;
      this.$repo.dispatch('parseSkin', this.skinUrl).then((skin) => {
        if (skin) { this.skinData = skin; }
      }, (e) => {
        this.$notify('error', this.$t('user.skinParseFailed', e));
      }).finally(() => {
        this.parsingSkin = false;
      });
    },
    async doLoadSkin() {
      await this.$nextTick();
      this.$electron.remote.dialog.showOpenDialog({ title: this.$t('user.openSkinFile'), filters: [{ extensions: ['png'], name: 'PNG Images' }] }, (filename, bookmark) => {
        if (filename && filename[0]) {
          this.$repo.dispatch('parseSkin', filename[0]).then((skin) => {
            if (skin) {
              this.skinData = skin;
            }
          }, (e) => {
            this.$notify('error', this.$t('user.skinParseFailed', e));
          });
        }
      });
    },
    doReset() {
      if (this.modified) {
        const skin = this.gameProfile.textures.SKIN;
        const skinUrl = skin.url;
        const skinSlim = skin.metadata ? skin.metadata.model === 'slim' : false;

        this.skinData = skinUrl;
        this.skinSlim = skinSlim;
      }
    },
    doUpload() {
      if (this.offline) {
        console.warn('Cannot update skin during offline mode');
      } else {
        this.uploadingSkin = true;
        this.$repo.dispatch('uploadSkin', { data: this.skinData, slim: this.skinSlim }).then(() => this.refreshSkin(), (e) => {
          this.$notify('error', this.$t('user.uploadSkinFail', e));
        }).finally(() => {
          this.uploadingSkin = false;
        });
      }
    },
    doSaveSkin() {
      this.$electron.remote.dialog.showSaveDialog({ title: this.$t('user.skinSaveTitle'), defaultPath: `${this.user.name}.png`, filters: [{ extensions: ['png'], name: 'PNG Images' }] }, (filename, bookmark) => {
        if (filename) {
          this.$repo.dispatch('saveSkin', { path: filename, skin: { data: this.skinData, slim: this.skinSlim } });
        }
      });
    },
    enterEditBtn() {
      this.hoverTextOnEdit = this.$t('user.skinImportFile');
    },
    enterLinkBtn() {
      this.hoverTextOnEdit = this.$t('user.skinImportLink');
    },
    enterSaveBtn() {
      this.hoverTextOnEdit = this.$t('user.skinSave');
    },
    updateSkinUrl(url) {
      this.skinUrlError = this.skinUrlFormat.some(r => typeof r(url) === 'string');
    },
    switchUser(profile) {
      this.$repo.dispatch('switchUserProfile', {
        profileId: profile.id,
        userId: profile.userId,
      });
    },
    toggleSwitchUser() {
      this.$electron.ipcRenderer.emit('login', true);
    },
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
