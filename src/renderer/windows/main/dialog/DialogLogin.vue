<template>
  <v-dialog v-model="isShown" width="500" :persistent="!switchingUser">
    <v-card style="padding-bottom: 25px;">
      <v-flex text-xs-center pa-4 class="green">
        <v-icon style="font-size: 50px">
          person_pin
        </v-icon>
      </v-flex>
      <v-tabs
        v-model="tabIndex"
        fixed-tabs
        color="transparent"
      >
        <v-tab>
          <v-icon left>
            person_add
          </v-icon>
          {{ $t('user.account.add') }}
        </v-tab>

        <v-tab :disabled="avaiableGameProfiles.length === 0">
          <v-icon left>
            people
          </v-icon>
          {{ $t('user.account.switch') }}
        </v-tab>

        <v-tab-item :key="0">
          <v-card-text style="padding-left: 50px; padding-right: 50px; padding-bottom: 0px;">
            <v-form ref="form" v-model="isFormValid">
              <v-layout>
                <v-flex xs6>
                  <v-select v-model="selectedAuthService" 
                            prepend-icon="vpn_key" 
                            :items="authServices" 
                            :item-value="t => t"
                            :item-text="t => $te(`user.${t}.name`) ? $t(`user.${t}.name`) : t"
                            :label="$t('user.authMode')"
                            flat dark />
                </v-flex>
                <v-flex xs6>
                  <v-select v-model="selectedProfileService" 
                            prepend-icon="receipt" 
                            :items="profileServices" 
                            :item-value="t => t"
                            :item-text="t => $te(`user.${t}.name`) ? $t(`user.${t}.name`) : t"
                            :label="$t('user.profileMode')"
                            flat dark />
                </v-flex>
              </v-layout>

              <v-combobox ref="accountInput" 
                          v-model="account" 
                          dark 
                          prepend-icon="person"
                          required 
                          :label="$t(`user.${selectedAuthService === 'offline' ? 'offline' : 'mojang'}.account`)"
                          :rules="accountRules" 
                          :items="loginHistory" 
                          :error="accountError" 
                          :error-messages="accountErrors"
                          @input="accountError=false" @keypress="resetError" />

              <v-text-field v-model="password" 
                            dark 
                            prepend-icon="lock" 
                            type="password" 
                            required
                            :label="$t(`user.${selectedAuthService === 'offline' ? 'offline' : 'mojang'}.password`)"
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
            <template v-for="p in avaiableGameProfiles">
              <v-list-tile :key="p.id" 
                           ripple avatar 
                           :class="{ green: isUserSelected(p) }"
                           @click="selectUserProfile(p)">
                <v-list-tile-avatar>
                  <image-show-texture-head :src="p.textures.SKIN.url" :dimension="50" />
                </v-list-tile-avatar>
                <v-list-tile-content>
                  <v-list-tile-title>
                    {{ p.name }}
                  </v-list-tile-title>
                  <v-list-tile-sub-title>{{ p.id }}</v-list-tile-sub-title>
                  <v-list-tile-sub-title>
                    <v-chip small outline label :color="isUserSelected(p) ? 'white': ''" style="margin: 0; margin-top: 4px">
                      {{ $t('user.authMode') }}: 
                      {{ p.authService }}
                    </v-chip>
                    <v-chip small outline label :color="isUserSelected(p) ? 'white': ''" style="margin: 0; margin-top: 4px">
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
          <v-card-actions style="padding-left: 40px; padding-right: 40px;">
            <v-flex text-xs-center style="z-index: 1;">
              <v-btn block :disabled="avaiableGameProfiles.length === 0 || userId === ''" :loading="logining" color="green" round large style="color: white" dark @click="comfirmSwitchUser">
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
import { reactive, computed, watch, toRefs, onMounted, onUnmounted, ref } from '@vue/composition-api';
import { useCurrentUser, useDialogSelf, useI18n, useLogin } from '@/hooks';

export default {
  setup(props, context) {
    const { t } = useI18n();
    const { loginHistory, logined, account, authService, profileService, id } = useCurrentUser();
    const { closeDialog, isShown, showDialog, dialogOption: switchingUser } = useDialogSelf('login');
    const {
      avaiableGameProfiles,
      profileServices,
      authServices,
      login: loginAccount,
      removeAccount,
      switchAccount,
    } = useLogin();
    const usernameRules = [v => !!v || t('user.requireUsername')];
    const emailRules = [
      v => !!v || t('user.requireEmail'),
      v => /^\w+([.-]?\w+)*@\w+([.-]?\w+)*(\.\w{2,3})+$/.test(v)
        || t('user.illegalEmail'),
    ];
    const passwordRules = [v => !!v || t('user.requirePassword')];
    const data = reactive({
      userId: '',
      profileId: '',

      account: '',
      password: '',
      selectedAuthService: '',
      selectedProfileService: '',

      tabIndex: 0,
      logining: false,
      isFormValid: true,

      accountError: false,
      accountErrors: [],

      passwordError: false,
      passwordErrors: [],
    });
    const accountInput = ref(null);
    const form = ref(null);
    const accountRules = computed(() => (data.selectedAuthService === 'offline'
      ? usernameRules
      : emailRules));

    function reload() {
      data.selectedUserProfile = id;
      data.account = account.value;
      data.selectedAuthService = authService.value;
      data.selectedProfileService = profileService.value;
    }
    function isUserSelected(profile) {
      return data.userId === profile.userId
        && data.profileId === profile.id;
    }
    function resetError() {
      data.accountError = false;
      data.accountErrors = [];
      data.passwordError = false;
      data.passwordErrors = [];
    }
    function handleKey(e) {
      resetError();
      if (e.key === 'Enter') { login(); }
    }
    async function login() {
      data.logining = true;
      accountInput.value.blur();
      await context.root.$nextTick(); // wait a tick to make sure this.account updated.
      try {
        await loginAccount({
          account: data.account,
          password: data.password,
          authService: data.selectedAuthService,
          profileService: data.selectedAuthService,
        });
        closeDialog();
      } catch (e) {
        if (e.type === 'ForbiddenOperationException'
          && e.message === 'Invalid credentials. Invalid username or password.'
        ) {
          const msg = t('user.invalidCredentials');
          data.accountError = true;
          data.accountErrors = [msg];
          data.passwordError = true;
          data.passwordErrors = [msg];
        }
        console.error(e);
      } finally {
        data.logining = false;
      }
    }

    let loginedHandle;
    let shownHandle;
    let authServiceHandle;
    onMounted(() => {
      reload();
      if (!logined.value) {
        showDialog();
      }
      loginedHandle = watch(logined, (l) => {
        if (!l) {
          showDialog();
        } else {
          closeDialog();
        }
      });
      shownHandle = watch(isShown, (s) => {
        if (s) {
          reload();
          data.tabIndex = switchingUser.value ? 1 : 0;
        }
      });
      authServiceHandle = watch(data.selectedAuthService, () => {
        form.value.resetValidation();
        if (data.selectedAuthService !== data.selectedProfileService
          && data.selectedProfileService === '') {
          if (profileServices.value.find(p => p.value === data.selectedAuthService)) {
            data.selectedProfileService = data.selectedAuthService;
          } else {
            data.selectedProfileService = 'mojang';
          }
        }
      });
    });
    onUnmounted(() => {
      loginedHandle();
      shownHandle();
      authServiceHandle();
    });
    return {
      ...toRefs(data),
      isShown,
      resetError,
      switchingUser,
      login,
      avaiableGameProfiles,
      profileServices,
      authServices,
      accountRules,
      passwordRules,
      loginHistory,
      handleKey,
      accountInput,
      form,
      isUserSelected,
      deleteGameProfile(profile) {
        removeAccount(profile.userId);
      },
      selectUserProfile(profile) {
        data.userId = profile.userId;
        data.profileId = profile.id;
      },
      async comfirmSwitchUser() {
        if (switchingUser.value) {
          console.log(`Select User profile ${data.userId} ${data.profileId}.`);
          try {
            await switchAccount({
              userId: data.userId,
              profileId: data.profileId,
            });
          } catch (e) {
            console.error(`An error occured during select user profile ${data.userId} ${data.profileId}`);
            console.error(e);
          } finally {
            if (logined.value) { closeDialog(); }
          }
        }
      },
    };
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
