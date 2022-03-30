<template>
  <div>
    <hint
      v-if="showDropHint"
      icon="save_alt"
      :text="$t('user.dropHint').toString()"
      style="height: 350px"
    />
    <v-card-text v-if="!showDropHint">
      <v-form
        ref="form"
        v-model="isFormValid"
      >
        <v-layout class="pt-6">
          <v-flex xs12>
            <v-select
              v-model="authServiceItem"
              prepend-icon="vpn_key"
              :items="authServiceItems"
              :label="$t('user.authMode')"
              flat
            >
              <template #append-outer>
                <v-tooltip top>
                  <template #activator="{on}">
                    <v-btn
                      icon
                      v-on="on"
                      @click="$emit('route', 'profile')"
                    >
                      <v-icon>add</v-icon>
                    </v-btn>
                  </template>
                  {{ $t('user.service.add') }}
                </v-tooltip>
              </template>
            </v-select>
          </v-flex>
        </v-layout>

        <v-combobox
          ref="accountInput"
          v-model="username"
          :items="history"

          prepend-icon="person"
          required
          :label="
            $te(`user.${authService}.account`)
              ? $t(`user.${authService}.account`)
              : $t(`user.${'offline'}.account`)
          "
          :rules="usernameRules"
          :error="!!usernameErrors.length"
          :error-messages="usernameErrors"
          @input="usernameErrors = []"
          @keypress="resetError"
        />

        <v-text-field
          v-model="password"
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
      <div class="w-full text-center">
        <div
          @mouseenter="onMouseEnterLogin"
          @mouseleave="onMouseLeaveLogin"
        >
          <v-btn
            block
            :loading="isLogining && (!hovered || authService !== 'microsoft')"
            color="green"
            rounded
            large
            style="color: white"

            @click="login"
          >
            <span v-if="!isLogining">
              {{ $t("user.login") }}
            </span>
            <v-icon v-else>
              close
            </v-icon>
          </v-btn>
        </div>

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
      </div>
    </v-card-actions>
  </div>
</template>

<script lang=ts>
import { computed, defineComponent, inject, nextTick, onMounted, reactive, ref, Ref, toRefs, watch } from '@vue/composition-api'
import { LoginException, UserServiceKey } from '@xmcl/runtime-api'
import Hint from '/@/components/Hint.vue'
import { IssueHandler, useBusy, useI18n, useService, useServiceOnly } from '/@/composables'
import { required } from '/@/util/props'
import { useDialog } from '../composables/dialog'
import { useSelectedServices } from '../composables/login'
import { useCurrentUser, useLoginValidation, useUserProfileStatus } from '../composables/user'

interface ServiceItem {
  text: string
  value: string
}

export default defineComponent({
  components: { Hint },
  props: { inside: required(Boolean) },
  setup(props) {
    const { hide, isShown, show } = useDialog('login')

    // handle the not login issue
    const issueHandler = inject(IssueHandler)
    if (issueHandler) {
      issueHandler.userNotLogined = show
    }

    const data = reactive({
      username: '',
      password: '',
      isFormValid: true,
    })

    const accountInput: Ref<any> = ref(null)
    const form: Ref<any> = ref(null)
    const hovered = ref(false)

    const { $te, $t } = useI18n()
    const { login } = useServiceOnly(UserServiceKey, 'login', 'switchUserProfile')
    const { state, removeUserProfile, cancelMicrosoftLogin } = useService(UserServiceKey)
    const authServiceItems: Ref<ServiceItem[]> = computed(() => ['microsoft', ...Object.keys(state.authServices), 'offline']
      .map((a) => ({ value: a, text: $te(`user.${a}.name`) ? $t(`user.${a}.name`) : a })))
    const profileServices: Ref<ServiceItem[]> = computed(() => Object.keys(state.profileServices)
      .map((a) => ({ value: a, text: $te(`user.${a}.name`) ? $t(`user.${a}.name`) : a })))
    const { userProfile } = useCurrentUser()
    const { logined } = useUserProfileStatus(userProfile)
    const { profileService, authService, history } = useSelectedServices()
    const isOffline = computed(() => authServiceItem.value.value === 'offline')
    const isThirdParty = computed(() => {
      const service = authServiceItem.value.value
      if (service !== 'mojang' && service !== 'microsoft') {
        return true
      }
      return false
    })

    const isLogining = useBusy('login()')
    const isMicrosoft = computed(() => authService.value === 'microsoft')
    const isPersistent = computed(() => !logined.value)
    const passwordLabel = computed(() => ($te(`user.${authService.value}.password`)
      ? $t(`user.${authService.value}.password`)
      : $t(`user.${isOffline.value ? 'offline' : 'mojang'}.password`)))
    const showDropHint = computed(() => isMicrosoft.value && props.inside && isLogining.value)

    const authServiceItem = computed<ServiceItem>({
      get() { return authServiceItems.value.find(a => a.value === authService.value)! },
      set(v) { authService.value = v as any as string },
    })
    const {
      usernameRules,
      usernameErrors,
      passwordRules,
      passwordErrors,
      reset: resetError,
      handleError,
    } = useLoginValidation(isThirdParty)

    function reset() {
      data.username = history.value[0] ?? ''
      data.password = ''
    }

    async function onLogin() {
      resetError()
      accountInput.value.blur()
      await nextTick() // wait a tick to make sure username updated.
      try {
        if (isLogining.value) {
          await cancelMicrosoftLogin()
          return
        }
        const index = history.value.indexOf(data.username)
        if (index === -1) {
          history.value.unshift(data.username)
        }
        await login({ ...data, authService: authService.value, profileService: profileService.value })
        hide()
      } catch (e) {
        handleError(e as LoginException)
        console.log(e)
      }
    }

    onMounted(() => {
      reset()
    })

    watch(isShown, (s) => {
      if (!s) { return }
      if (!logined.value) {
        // data.selectProfile = true
      }
      if (s) {
        reset()
      }
    })
    watch([authService, profileService], () => {
      if (authService.value !== profileService.value && profileService.value === '') {
        profileService.value = (profileServices.value.find(p => p.value === authService.value) ?? profileServices.value.find(p => p.value === 'mojang')!).value
      }
    })

    const onMouseEnterLogin = () => {
      hovered.value = true
    }
    const onMouseLeaveLogin = () => {
      hovered.value = false
    }

    return {
      ...toRefs(data),
      hovered,
      isLogining,
      authService,
      authServiceItem,
      authServiceItems,
      isOffline,
      isMicrosoft,

      onMouseEnterLogin,
      onMouseLeaveLogin,

      isShown,

      resetError,

      login: onLogin,

      usernameRules,
      passwordRules,
      usernameErrors,
      passwordErrors,

      isPersistent,

      accountInput,
      history,
      form,
      showDropHint,
      passwordLabel,
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
