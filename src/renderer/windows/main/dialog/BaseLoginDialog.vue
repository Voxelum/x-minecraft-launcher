<template>
  <v-dialog
    v-model="isShown"
    width="500"
    :persistent="persistent"
  >
    <v-card style="padding-bottom: 25px;">
      <v-flex
        text-xs-center
        pa-4
        class="green"
      >
        <v-icon style="font-size: 50px">person_pin</v-icon>
      </v-flex>
      <v-card-text style="padding-left: 50px; padding-right: 50px; padding-bottom: 0px;">
        <v-form
          ref="form"
          v-model="isFormValid"
        >
          <v-layout>
            <v-flex xs6>
              <v-select
                v-model="authService"
                prepend-icon="vpn_key"
                :items="authServices"
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
        <v-flex
          text-xs-center
          style="z-index: 1;"
        >
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
    </v-card>
  </v-dialog>
</template>

<script lang=ts>
import { reactive, computed, watch, toRefs, onMounted, ref, defineComponent, Ref } from '@vue/composition-api';
import { useLogin, useLoginValidation, useI18n } from '@/hooks';
import { useLoginDialog } from '../hooks/index';

export default defineComponent({
  setup(props, context) {
    const { hide, isShown, show } = useLoginDialog();
    const { $te, $t } = useI18n();
    const {
      username,
      password,
      authService,
      profileService,

      selectedProfile,

      selectProfile,

      logined,
      logining,
      login,
      remove,
      reset,

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
    const persistent = computed(() => !logined.value);
    const data = reactive({
      isFormValid: true,
    });
    const accountInput: Ref<any> = ref(null);
    const form: Ref<any> = ref(null);

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
        if (!logined.value) {
          selectProfile.value = true;
        }
        reset();
      });
      watch([authService, profileService], () => {
        form.value.resetValidation();
        if (authService.value !== profileService.value && profileService.value === '') {
          profileService.value = profileServices.value.find(p => p === authService.value) ?? 'mojang';
        }
      });
    });
    const _profileServices = computed(() => profileServices.value.map((a) => ({ value: a, text: $te(`user.${a}.name`) ? $t(`user.${a}.name`) : a })));
    const _authServices = computed(() => authServices.value.map((a) => ({ value: a, text: $te(`user.${a}.name`) ? $t(`user.${a}.name`) : a })));
    return {
      ...toRefs(data),
      logining,
      username,
      password,
      authService: computed<{ value: string; text: string }>({
        get() { return _authServices.value.find(a => a.value === authService.value)!; },
        set(v) { authService.value = v as any as string; },
      }),
      profileService: computed<{ value: string; text: string }>({
        get() { return _profileServices.value.find(a => a.value === profileService.value)!; },
        set(v) { profileService.value = v as any as string; },
      }),
      profileServices: _profileServices,
      authServices: _authServices,
      isOffline,

      selectedProfile,

      isShown,

      resetError,

      login: _login,
      remove,

      usernameRules,
      passwordRules,
      usernameErrors,
      passwordErrors,

      persistent,

      accountInput,
      form,
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
