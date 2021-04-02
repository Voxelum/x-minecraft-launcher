<template>
  <v-dialog
    v-model="isShown"
    width="500"
    :persistent="persistent"
    @dragover.prevent
  >
    <v-card
      class="login-card"
      @dragover.prevent
      @drop="onDrop"
    >
      <v-flex
        text-xs-center
        pa-4
        class="green"
      >
        <v-icon style="font-size: 50px">
          person_pin
        </v-icon>
      </v-flex>
      <hint
        v-if="showDropHint"
        icon="save_alt"
        :text="$t('user.dropHint')"
        style="height: 350px"
      />
      <v-card-text v-if="!showDropHint">
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
            :items="history"
            dark
            prepend-icon="person"
            required
            :label="
              $te(`user.${authService.value}.account`)
                ? $t(`user.${authService.value}.account`)
                : $t(`user.${isOffline ? 'offline' : 'mojang'}.account`)
            "
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
            :label="passwordLabel"
            :rules="passwordRules"
            :disabled="isOffline || isMicrosoft"
            :error="!!passwordErrors.length"
            :error-messages="passwordErrors"
            @input="passwordErrors = []"
            @keypress.enter="login"
          />
        </v-form>
      </v-card-text>
      <v-card-actions
        v-if="!showDropHint"
        style="padding-left: 40px; padding-right: 40px"
      >
        <v-flex
          text-xs-center
          style="z-index: 1"
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
          >
            {{ $t("user.login") }}
          </v-btn>
          <div style="margin-top: 25px">
            <a
              style="padding-right: 10px; z-index: 20"
              href="https://my.minecraft.net/en-us/password/forgot/"
            >{{ $t("user.forgetPassword") }}</a>
            <a
              style="z-index: 20"
              href="https://my.minecraft.net/en-us/store/minecraft/#register"
            >
              {{ $t("user.signupDescription") }}
              {{ $t("user.signup") }}
            </a>
          </div>
        </v-flex>
      </v-card-actions>
    </v-card>
  </v-dialog>
</template>

<script lang=ts>
import { reactive, computed, watch, toRefs, onMounted, ref, defineComponent, Ref, nextTick } from '@vue/composition-api'
import { useLogin, useLoginValidation, useI18n, useService } from '/@/hooks'
import { useLoginDialog } from '../hooks/index'
import Hint from '../components/Hint.vue'
import { BaseServiceKey } from '/@shared/services/BaseService'

export default defineComponent({
  components: { Hint },
  setup(props, context) {
    const { hide, isShown, show } = useLoginDialog()
    const { $te, $t } = useI18n()
    const inside = ref(false)
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

      history,
      profileServices,
      authServices,
    } = useLogin()
    const isOffline = computed(() => authService.value.value === 'offline')
    const {
      usernameRules,
      usernameErrors,
      passwordRules,
      passwordErrors,
      reset: resetError,
      handleError,
    } = useLoginValidation(isOffline)
    const isMicrosoft = computed(() => authService.value.value === 'microsoft')
    const persistent = computed(() => !logined.value)
    const data = reactive({
      isFormValid: true,
    })
    const accountInput: Ref<any> = ref(null)
    const form: Ref<any> = ref(null)
    const passwordLabel = computed(() => ($te(`user.${authService.value.value}.password`)
      ? $t(`user.${authService.value.value}.password`)
      : $t(`user.${isOffline.value ? 'offline' : 'mojang'}.password`)))
    const showDropHint = computed(() => isMicrosoft.value && inside.value && logining.value)

    async function _login() {
      resetError()
      accountInput.value.blur()
      await nextTick() // wait a tick to make sure username updated.
      try {
        await login()
        hide()
      } catch (e) {
        handleError(e)
        console.log(e)
      }
    }

    onMounted(() => {
      if (!logined.value) {
        show()
      }
      watch(logined, (l) => {
        isShown.value = !l
      })
      watch(isShown, (s) => {
        if (!s) { return }
        if (!logined.value) {
          selectProfile.value = true
        }
        reset()
      })
      watch([authService, profileService], () => {
        form.value.resetValidation()
        if (authService.value !== profileService.value && profileService.value.value === '') {
          profileService.value = profileServices.value.find(p => p === authService.value) ?? profileServices.value.find(p => p.value === 'mojang')!
        }
      })
    })

    document.addEventListener('dragleave', (e) => {
      if ((e as any).fromElement === null && e.dataTransfer!.effectAllowed === 'copyLink') {
        inside.value = false
      }
    })
    document.addEventListener('dragenter', (e) => {
      if ((e as any).fromElement === null && e.dataTransfer!.effectAllowed === 'copyLink') {
        inside.value = true
      }
    })
    const { handleUrl } = useService(BaseServiceKey)
    const onDrop = (e: DragEvent) => {
      const url = e.dataTransfer?.getData('xmcl/url')
      if (url) {
        handleUrl(url)
      }
      inside.value = false
    }

    return {
      ...toRefs(data),
      logining,
      username,
      password,
      authService,
      profileService,
      profileServices,
      authServices,
      isOffline,
      isMicrosoft,

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
      history,
      form,
      showDropHint,
      passwordLabel,
      onDrop,
    }
  },
})
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

.login-card {
  padding-bottom: 25px;
}

.login-card .v-card__text {
  padding-left: 50px;
  padding-right: 50px;
  padding-bottom: 0px;
}
</style>
