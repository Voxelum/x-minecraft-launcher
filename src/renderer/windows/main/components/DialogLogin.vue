<template>
  <v-dialog v-model="show" width="500" :persistent="!switchingUser">
    <v-card style="padding-bottom: 25px;">
      <v-flex text-xs-center pa-4 class="green">
        <v-icon style="font-size: 50px">
          person_pin
        </v-icon>
      </v-flex>
      <v-tabs
        v-model="loginOrSwitchUser"
        fixed-tabs
        color="transparent"
      >
        <v-tab>
          <v-icon left>
            person_add
          </v-icon>
          {{ $t('user.account.add') }}
        </v-tab>

        <v-tab>
          <v-icon left>
            people
          </v-icon>
          {{ $t('user.account.switch') }}
        </v-tab>

        <v-tab-item :key="0">
          <v-card-text style="padding-left: 50px; padding-right: 50px; padding-bottom: 0px;">
            <v-form ref="form" v-model="valid">
              <v-layout>
                <v-flex xs6>
                  <v-select v-model="selectedAuthService" 
                            prepend-icon="vpn_key" :items="authServices" 
                            :label="$t('user.authMode')"
                            flat dark />
                </v-flex>
                <v-flex xs6>
                  <v-select v-model="selectedProfileService" 
                            prepend-icon="receipt" :items="profileServices" 
                            :label="$t('user.profileMode')"
                            flat dark />
                </v-flex>
              </v-layout>

              <v-combobox ref="accountInput" 
                          v-model="account" 
                          dark 
                          prepend-icon="person"
                          required 
                          :label="$t(`user.${selectedAuthService}.account`)"
                          :rules="accountRules" 
                          :items="history" 
                          :error="accountError" 
                          :error-messages="accountErrors"
                          @input="accountError=false" @keypress="resetError" />

              <v-text-field v-model="password" 
                            dark 
                            prepend-icon="lock" 
                            type="password" 
                            required
                            :label="$t(`user.${selectedAuthService}.password`)"
                            :rules="passwordRules" 
                            :disabled="selectedAuthService==='offline'" 
                            :error="passwordError"
                            :error-messages="passwordErrors" 
                            @input="passwordError=false" @keypress="handleKey" />
            </v-form>
          </v-card-text>
          <v-card-actions style="padding-left: 40px; padding-right: 40px;">
            <v-flex text-xs-center style="z-index: 1;">
              <v-btn block :loading="logining" color="green" round large style="color: white" dark @click="login">
                {{ $t('user.login') }}
              </v-btn>
              <div style="margin-top: 25px;">
                <a style="padding-right: 10px; z-index: 20" href="https://my.minecraft.net/en-us/password/forgot/">{{ $t('user.forgetPassword') }}</a>
                <a style="z-index: 20" href="https://my.minecraft.net/en-us/store/minecraft/#register">{{ $t('user.signupDescription') }}
                  {{ $t('user.signup') }}</a>
              </div>
            </v-flex>
          </v-card-actions>
        </v-tab-item>
        <v-tab-item :key="1">
          <v-list three-line> 
            <template v-for="p in gameProfiles">
              <v-list-tile :key="p.id" 
                           ripple avatar 
                           :class="{ green: selectedUserProfile === p }"
                           @click="selectedUserProfile = p">
                <v-list-tile-avatar>
                  <image-show-texture-head :src="p.textures.SKIN.url" :dimension="50" />
                </v-list-tile-avatar>
                <v-list-tile-content>
                  <v-list-tile-title>
                    {{ p.name }}
                  </v-list-tile-title>
                  <v-list-tile-sub-title>{{ p.id }}</v-list-tile-sub-title>
                  <v-list-tile-sub-title>
                    <v-chip small outline label :color="selectedUserProfile === p ? 'white': ''" style="margin: 0; margin-top: 4px">
                      {{ $t('user.authMode') }}: 
                      {{ p.authService }}
                    </v-chip>
                    <v-chip small outline label :color="selectedUserProfile === p ? 'white': ''" style="margin: 0; margin-top: 4px">
                      {{ $t('user.profileMode') }}: 
                      {{ p.profileService }}
                    </v-chip>
                  </v-list-tile-sub-title>
                </v-list-tile-content>
                <v-list-tile-action>
                  <v-btn flat icon>
                    <v-icon color="red" @click="deleteGameProfile(p)">
                      delete
                    </v-icon>
                  </v-btn>
                </v-list-tile-action>
              </v-list-tile>
            </template>
          </v-list>
          <!-- <v-container grid-list-md>
            <v-layout row wrap style="max-height: 40vh; overflow-y: auto">
              <v-flex v-for="p of gameProfiles" :key="p.id" d-flex xs6 draggable>
                <v-card :color="selectedUserProfile === p ? 'green': 'transparent'" flat hover @click="selectedUserProfile = p">
                  <v-container>
                    <v-layout row>
                      <v-flex xs4 style="height: 64px; max-width: 64px; overflow: hidden">
                        <img style="image-rendering: pixelated; transform: scale(9.5) translate(17.5px, 4.8px)" :src="sample">
                      </v-flex>
                      <v-flex xs8>
                        {{ p.name }}
                        <span style="line-wrap: auto">
                          ({{ p.id }})
                        </span>
                      </v-flex>
                    </v-layout>
                  </v-container>
                </v-card>
              </v-flex>
            </v-layout>
          </v-container> -->
          <v-card-actions style="padding-left: 40px; padding-right: 40px;">
            <v-flex text-xs-center style="z-index: 1;">
              <v-btn block :loading="logining" color="green" round large style="color: white" dark @click="comfirmSwitchUser">
                {{ $t('user.account.switch') }}
              </v-btn>
            </v-flex>
          </v-card-actions>
        </v-tab-item>
      </v-tabs>
    </v-card>
  </v-dialog>
</template>

<script>

export default {
  props: {
  },
  data() {
    return {
      show: false,
      switchingUser: false,

      selectedUserProfile: {},
      loginOrSwitchUser: 0,
      account: '',
      password: '',
      logining: false,
      valid: true,

      accountError: false,
      accountErrors: [],

      passwordError: false,
      passwordErrors: [],

      usernameRules: [v => !!v || this.$t('user.requireUsername')],
      emailRules: [
        v => !!v || this.$t('user.requireEmail'),
        v => /^\w+([.-]?\w+)*@\w+([.-]?\w+)*(\.\w{2,3})+$/.test(v)
          || this.$t('user.illegalEmail'),
      ],
      passwordRules: [v => !!v || this.$t('user.requirePassword')],
      selectedAuthService: '',
      selectedProfileService: '',
    };
  },
  computed: {
    authServices() {
      return this.$repo.getters.authServices.map(m => ({
        text: this.$t(`user.${m}.name`),
        value: m,
      }));
    },
    profileServices() {
      return this.$repo.getters.profileServices.map(m => ({
        text: this.$t(`user.${m}.name`),
        value: m,
      }));
    },
    accountRules() {
      return this.selectedAuthService === 'offline'
        ? this.usernameRules
        : this.emailRules;
    },
    history() {
      return this.$repo.state.user.loginHistory;
    },
    gameProfiles() { return this.$repo.getters.avaiableGameProfiles; },
    logined() { return this.$repo.getters.logined; },
  },
  watch: {
    selectedAuthService() {
      this.$refs.form.resetValidation();
      if (this.selectedAuthService !== this.selectedProfileService
        && this.selectedProfileService === '') {
        if (this.profileServices.find(p => p.value === this.selectedAuthService)) {
          this.selectedProfileService = this.selectedAuthService;
        } else {
          this.selectedProfileService = 'mojang';
        }
      }
    },
    logined() {
      if (!this.logined) {
        this.show = true;
      } else {
        this.show = false;
      }
    },
    show() {
      if (this.show) {
        this.reload();
        this.loginOrSwitchUser = this.switchingUser ? 1 : 0;
      }
    },
  },
  mounted() {
    this.reload();
    this.$electron.ipcRenderer.on('login', (sw = false) => {
      this.switchingUser = sw;
      this.show = true;
    });
    if (!this.logined) {
      this.show = true;
    }
  },
  methods: {
    reload() {
      this.selectedUserProfile = this.$repo.getters.selectedUser;
      this.account = this.selectedUserProfile.account;
      this.selectedAuthService = this.selectedUserProfile.authService;
      this.selectedProfileService = this.selectedUserProfile.profileService;
    },
    resetError() {
      this.accountError = false;
      this.accountErrors = [];
      this.passwordError = false;
      this.passwordErrors = [];
    },
    handleKey(e) {
      this.resetError();
      if (e.key === 'Enter') {
        this.login();
      }
    },
    async comfirmSwitchUser() {
      if (this.switchingUser !== {}) {
        console.log(`Select User profile ${this.selectedUserProfile.userId} ${this.selectedUserProfile.id}`);
        this.$repo.dispatch('switchUserProfile', {
          userId: this.selectedUserProfile.userId,
          profileId: this.selectedUserProfile.id,
        }).finally(() => {
          if (this.logined) {
            this.show = false;
          }
        });
      }
    },
    deleteGameProfile(profile) { 
      this.$repo.commit('removeUserProfile', profile.userId);
    },
    async login() {
      this.logining = true;
      this.$refs.accountInput.blur();
      await this.$nextTick(); // wait a tick to make sure this.account updated.
      try {
        await this.$repo.dispatch('login', {
          account: this.account,
          password: this.password,
          authService: this.selectedAuthService,
          profileService: this.selectedAuthService,
        });
      } catch (e) {
        if (
          e.type === 'ForbiddenOperationException'
          && e.message === 'Invalid credentials. Invalid username or password.'
        ) {
          const msg = this.$t('user.invalidCredentials');
          this.accountError = true;
          this.accountErrors = [msg];
          this.passwordError = true;
          this.passwordErrors = [msg];
        }
        console.error(e);
      } finally {
        this.logining = false;
      }
    },
    pathOfSkin() {

    },
  },
};
</script>

<style>
.input-group {
  padding-top: 5px;
}
.password {
  padding-top: 5px;
}
.input-group--text-field label {
  top: 5px;
}
</style>
