<template>
  <div>
    <hint
      v-if="showDropHint"
      icon="save_alt"
      :text="t('login.dropHint').toString()"
      style="height: 350px"
    />
    <v-card-text v-if="!showDropHint">
      <v-form
        ref="form"
        v-model="data.isFormValid"
      >
        <v-layout class="pt-6">
          <v-flex xs12>
            <v-select
              v-model="authServiceItem"
              prepend-icon="vpn_key"
              :items="authServiceItems"
              :label="t('user.authMode')"
              flat
            >
              <template #append-outer>
                <v-tooltip top>
                  <template #activator="{ on: onTooltip }">
                    <v-btn
                      icon
                      v-on="onTooltip"
                      @click="emit('route', 'profile')"
                    >
                      <v-icon>add</v-icon>
                    </v-btn>
                  </template>
                  {{ t('userService.add') }}
                </v-tooltip>
              </template>
            </v-select>
          </v-flex>
        </v-layout>

        <v-combobox
          ref="accountInput"
          v-model="data.username"
          :items="history"
          prepend-icon="person"
          required
          :label="
            te(`userServices.${authService}.account`)
              ? t(`userServices.${authService}.account`)
              : t(`userServices.offline.account`)
          "
          :rules="usernameRules"
          :error="!!usernameErrors.length"
          :error-messages="usernameErrors"
          @input="usernameErrors = []"
          @keypress="resetError"
        />

        <v-text-field
          v-if="!isOffline"
          v-model="data.password"
          prepend-icon="lock"
          type="password"
          required
          :label="passwordLabel"
          :rules="passwordRules"
          :disabled="isOffline || isMicrosoft"
          :error="!!passwordErrors.length"
          :error-messages="passwordErrors"
          @input="passwordErrors = []"
          @keypress.enter="onLogin"
        />
        <v-text-field
          v-else
          v-model="data.uuid"
          prepend-icon="fingerprint"
          :label="uuidLabel"
          @keypress.enter="onLogin"
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
            color="primary"
            rounded
            large
            class="text-white"
            @click="onLogin"
          >
            <span v-if="!isLogining">
              {{ t("login.login") }}
            </span>
            <v-icon v-else>
              close
            </v-icon>
          </v-btn>
        </div>

        <div
          v-if="data.microsoftUrl"
          class="mt-6"
        >
          <a
            :href="data.microsoftUrl"
            class="border-b border-b-current border-dashed"
          >
            {{ t('login.manualLoginUrl') }}
          </a>
        </div>

        <div class="mt-4">
          <a
            style="padding-right: 10px; z-index: 20"
            href="https://my.minecraft.net/en-us/password/forgot/"
          >{{
            t("login.forgetPassword")
          }}</a>
          <a
            style="z-index: 20"
            href="https://my.minecraft.net/en-us/store/minecraft/#register"
          >
            {{ t("login.signupDescription") }}
            {{ t("login.signup") }}
          </a>
        </div>
      </div>
    </v-card-actions>
  </div>
</template>

<script lang=ts setup>
import { Ref } from '@vue/composition-api'
import { isException, UserException, UserServiceKey } from '@xmcl/runtime-api'
import { useDialog } from '../composables/dialog'
import { useSelectedServices } from '../composables/login'
import { useCurrentUser, useLoginValidation, useUserProfileStatus } from '../composables/user'
import Hint from '/@/components/Hint.vue'
import { IssueHandlerKey, useI18n, useService, useServiceBusy } from '/@/composables'
import { injection } from '/@/util/inject'

interface ServiceItem {
  text: string
  value: string
}

const props = defineProps<{ inside: boolean }>()
const emit = defineEmits(['route'])

const { hide, isShown, show } = useDialog('login')

const data = reactive({
  username: '',
  password: '',
  uuid: '',
  isFormValid: true,
  microsoftUrl: '',
})

const accountInput: Ref<any> = ref(null)
const form: Ref<any> = ref(null)
const hovered = ref(false)

const { te, t } = useI18n()
const { state, cancelMicrosoftLogin, login, on } = useService(UserServiceKey)
const authServiceItems: Ref<ServiceItem[]> = computed(() => ['microsoft', ...Object.keys(state.authServices), 'offline']
  .map((a) => ({ value: a, text: te(`userServices.${a}.name`) ? t(`userServices.${a}.name`) : a })))

const { userProfile } = useCurrentUser()
const { logined } = useUserProfileStatus(userProfile)
const { profileService, authService, history } = useSelectedServices()
const isLogining = useServiceBusy(UserServiceKey, 'login')

const isMicrosoft = computed(() => authService.value === 'microsoft')
const isOffline = computed(() => authServiceItem.value.value === 'offline')
const isThirdParty = computed(() => {
  const service = authServiceItem.value.value
  if (service !== 'mojang' && service !== 'microsoft') {
    return true
  }
  return false
})

const passwordLabel = computed(() => (te(`userServices.${authService.value}.password`)
  ? t(`userServices.${authService.value}.password`)
  : t(`userServices.${isOffline.value ? 'offline' : 'mojang'}.password`)))
const showDropHint = computed(() => isMicrosoft.value && props.inside && isLogining.value)
const uuidLabel = computed(() => t('userServices.offline.uuid'))

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
} = useLoginValidation(isThirdParty)

function handleError(e: unknown) {
  if (isException(UserException, e)) {
    if (e.exception.type === 'loginInvalidCredentials') {
      const msg = t('loginError.invalidCredentials')
      usernameErrors.value = [msg]
      passwordErrors.value = [msg]
    } else if (e.exception.type === 'loginInternetNotConnected') {
      const msg = t('loginError.badNetworkOrServer')
      usernameErrors.value = [msg]
      passwordErrors.value = [msg]
    } else if (e.exception.type === 'loginGeneral') {
      const msg = t('loginError.requestFailed')
      usernameErrors.value = [msg]
      passwordErrors.value = [msg]
    } else if (e.exception.type === 'fetchMinecraftProfileFailed') {
      const msg = t('loginError.fetchMinecraftProfileFailed', { reason: `${e.exception.errorType}, ${e.exception.developerMessage}` })
      usernameErrors.value = [msg]
      passwordErrors.value = [msg]
    } else if (e.exception.type === 'userCheckGameOwnershipFailed') {
      const msg = t('loginError.checkOwnershipFailed')
      usernameErrors.value = [msg]
      passwordErrors.value = [msg]
    } else if (e.exception.type === 'userExchangeXboxTokenFailed') {
      const msg = t('loginError.loginXboxFailed')
      usernameErrors.value = [msg]
      passwordErrors.value = [msg]
    } else if (e.exception.type === 'userLoginMinecraftByXboxFailed') {
      const msg = t('loginError.loginMinecraftByXboxFailed')
      usernameErrors.value = [msg]
      passwordErrors.value = [msg]
    } else if (e.exception.type === 'loginReset') {
      const msg = t('loginError.connectionReset')
      usernameErrors.value = [msg]
      passwordErrors.value = [msg]
    } else if (e.exception.type === 'loginTimeout') {
      const msg = t('loginError.timeout')
      usernameErrors.value = [msg]
      passwordErrors.value = [msg]
    } else if (e.exception.type === 'userAcquireMinecraftTokenFailed') {
      const msg = t('loginError.acquireMinecraftTokenFailed')
      usernameErrors.value = [msg]
      passwordErrors.value = [msg]
    }
  } else {
    const msg = t('loginError.requestFailed')
    usernameErrors.value = [msg]
    passwordErrors.value = [JSON.stringify(e)]
  }
  console.error(e)
}

on('microsoft-authorize-url', (url) => {
  data.microsoftUrl = url
})

function reset() {
  data.username = history.value[0] ?? ''
  data.password = ''
}

async function onLogin() {
  resetError()
  accountInput.value.blur()
  await nextTick() // wait a tick to make sure username updated.
  if (isLogining.value) {
    await cancelMicrosoftLogin()
    return
  }
  const index = history.value.indexOf(data.username)
  if (index === -1) {
    history.value.unshift(data.username)
  }
  const payload = { ...data, authService: authService.value }
  await login(payload).catch(handleError)
  hide()
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

const onMouseEnterLogin = () => {
  hovered.value = true
}
const onMouseLeaveLogin = () => {
  hovered.value = false
}
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
