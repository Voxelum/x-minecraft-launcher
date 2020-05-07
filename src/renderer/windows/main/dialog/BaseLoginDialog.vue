<template>
  <v-dialog v-model="isShown" width="500" :persistent="persistent">
    <v-card style="padding-bottom: 25px;">
      <v-flex text-xs-center pa-4 class="green">
        <v-icon style="font-size: 50px">person_pin</v-icon>
      </v-flex>
      <v-tabs v-model="tabIndex" fixed-tabs color="transparent">
        <v-tab>
          <v-icon left>person_add</v-icon>
          {{ $t('user.account.add') }}
        </v-tab>

        <v-tab :disabled="profiles.length === 0">
          <v-icon left>people</v-icon>
          {{ $t('user.account.switch') }}
        </v-tab>

        <v-tab-item :key="0">
          <v-card-text style="padding-left: 50px; padding-right: 50px; padding-bottom: 0px;">
            <v-form ref="form" v-model="isFormValid">
              <v-layout>
                <v-flex xs6>
                  <v-select
                    v-model="authService"
                    prepend-icon="vpn_key"
                    :items="authServices"
                    :item-value="t => t"
                    :item-text="t => $te(`user.${t}.name`) ? $t(`user.${t}.name`) : $t(`user.${t}.name`)"
                    :label="$t('user.authMode')"
                    flat
                    dark
                  />
                </v-flex>
                <v-flex xs6>
                  <v-select
                    v-model="profileService"
                    prepend-icon="receipt"
                    :items="profileServices"
                    :item-value="t => t"
                    :item-text="t => $te(`user.${t}.name`) ? $t(`user.${t}.name`) : t"
                    :label="$t('user.profileMode')"
                    flat
                    dark
                  />
                </v-flex>
              </v-layout>

              <v-combobox
                ref="accountInput"
                v-model="username"
                dark
                prepend-icon="person"
                required
                :label="$t(`user.${isOffline ? 'offline' : 'mojang'}.account`)"
                :rules="usernameRules"
                :error="!!usernameErrors.length"
                :error-messages="usernameErrors"
                @input="usernameErrors = []"
                @keypress="resetError"
              />

              <v-text-field
                v-model="password"
                dark
                prepend-icon="lock"
                type="password"
                required
                :label="$t(`user.${isOffline ? 'offline' : 'mojang'}.password`)"
                :rules="passwordRules"
                :disabled="isOffline"
                :error="!!passwordErrors.length"
                :error-messages="passwordErrors"
                @input="passwordErrors = []"
                @keypress.enter="login"
              />
            </v-form>
          </v-card-text>
          <v-card-actions style="padding-left: 40px; padding-right: 40px;">
            <v-flex text-xs-center style="z-index: 1;">
              <v-btn
                block
                :loading="logining"
                color="green"
                round
                large
                style="color: white"
                dark
                @click="login"
              >{{ $t('user.login') }}</v-btn>
              <div style="margin-top: 25px;">
                <a
                  style="padding-right: 10px; z-index: 20"
                  href="https://my.minecraft.net/en-us/password/forgot/"
                >{{ $t('user.forgetPassword') }}</a>
                <a
                  style="z-index: 20"
                  href="https://my.minecraft.net/en-us/store/minecraft/#register"
                >
                  {{ $t('user.signupDescription') }}
                  {{ $t('user.signup') }}
                </a>
              </div>
            </v-flex>
          </v-card-actions>
        </v-tab-item>
        <v-tab-item :key="1">
          <v-list three-line>
            <template v-for="p in profiles">
              <v-list-tile
                :key="p.id"
                ripple
                avatar
                :class="{ green: isProfileSelected(p) }"
                @click="updateProfile(p)"
              >
                <v-list-tile-avatar>
                  <image-show-texture-head :src="p.textures.SKIN.url" :dimension="50" />
                </v-list-tile-avatar>
                <v-list-tile-content>
                  <v-list-tile-title>{{ p.name }}</v-list-tile-title>
                  <v-list-tile-sub-title>{{ p.id }}</v-list-tile-sub-title>
                  <v-list-tile-sub-title>
                    <v-chip
                      small
                      outline
                      label
                      :color="isProfileSelected(p) ? 'white': ''"
                      style="margin: 0; margin-top: 4px"
                    >
                      {{ $t('user.authMode') }}:
                      {{ p.authService }}
                    </v-chip>
                    <v-chip
                      small
                      outline
                      label
                      :color="isProfileSelected(p) ? 'white': ''"
                      style="margin: 0; margin-top: 4px"
                    >
                      {{ $t('user.profileMode') }}:
                      {{ p.profileService }}
                    </v-chip>
                  </v-list-tile-sub-title>
                </v-list-tile-content>
                <v-list-tile-action>
                  <v-btn flat icon @click="remove(p.userId)">
                    <v-icon color="red">delete</v-icon>
                  </v-btn>
                </v-list-tile-action>
              </v-list-tile>
            </template>
          </v-list>
          <v-card-actions style="padding-left: 40px; padding-right: 40px;">
            <v-flex text-xs-center style="z-index: 1;">
              <v-btn
                block
                :disabled="profiles.length === 0 || user === '' || profile === selectedProfile"
                :loading="logining"
                color="green"
                round
                large
                style="color: white"
                dark
                @click="confirmSwitchUser"
              >{{ $t('user.account.switch') }}</v-btn>
            </v-flex>
          </v-card-actions>
        </v-tab-item>
      </v-tabs>
    </v-card>
  </v-dialog>
</template>

<script lang=ts>
import { reactive, computed, watch, toRefs, onMounted, ref, defineComponent, Ref } from '@vue/composition-api';
import { useLogin, useLoginValidation } from '@/hooks';
import { useLoginDialog } from '../hooks/index';

export default defineComponent({
  setup(props, context) {
    const { hide, isShown, show, isSwitchingUser } = useLoginDialog();
    const {
      user,
      profile,

      username,
      password,
      authService,
      profileService,

      selectedProfile,

      logined,
      logining,
      profiles,
      login,
      remove,
      reset,
      select,

      profileServices,
      authServices,
    } = useLogin();
    const isOffline = computed(() => authService.value === 'offline');
    const {
      usernameRules,
      usernameErrors,
      passwordRules,
      passwordErrors,
      reset: resetError,
      handleError,
    } = useLoginValidation(isOffline);
    const persistent = computed(() => !logined.value || !isSwitchingUser.value);
    const data = reactive({
      tabIndex: 0,
      isFormValid: true,
    });
    const accountInput: Ref<any> = ref(null);
    const form: Ref<any> = ref(null);

    function isProfileSelected(payload: { id: string; userId: string }) {
      return user.value === payload.userId
        && profile.value === payload.id;
    }
    function updateProfile(payload: { id: string; userId: string }) {
      user.value = payload.userId;
      profile.value = payload.id;
    }
    async function _login() {
      resetError();
      accountInput.value.blur();
      await context.root.$nextTick(); // wait a tick to make sure username updated.
      try {
        await login();
        hide();
      } catch (e) {
        handleError(e);
        console.log(e);
      }
    }

    onMounted(() => {
      reset();
      if (!logined.value) {
        show();
      }
      watch(logined, (l) => {
        isShown.value = !l;
      });
      watch(isShown, (s) => {
        if (!s) { return; }
        reset();
        data.tabIndex = isSwitchingUser.value ? 1 : 0;
      });
      watch([authService, profileService], () => {
        form.value.resetValidation();
        if (authService.value !== profileService.value && profileService.value === '') {
          profileService.value = profileServices.value.find(p => p === authService.value) ?? 'mojang';
        }
      });
    });
    return {
      ...toRefs(data),
      logining,
      user,
      profile,
      username,
      password,
      authService,
      profileService,
      profiles,
      profileServices,
      authServices,
      isOffline,

      selectedProfile,

      isShown,

      resetError,
      isSwitchingUser,

      login: _login,
      remove,
      select,

      usernameRules,
      passwordRules,
      usernameErrors,
      passwordErrors,

      persistent,

      accountInput,
      form,
      isProfileSelected,
      updateProfile,
      async confirmSwitchUser() {
        console.log(`Select User profile ${user.value} ${profile.value}.`);
        try {
          await select();
        } catch (e) {
          console.error(`An error occurred during select user profile ${user.value} ${profile.value}.`);
          console.error(e);
        } finally {
          if (logined.value) { hide(); }
        }
      },
    };
  },
});
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
