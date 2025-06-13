<template>
  <Hint
    v-if="showDropHint"
    icon="save_alt"
    :text="t('login.dropHint').toString()"
  />
  <div
    v-else
    class="min-w-100  m-20 text-center"
  >
    <UserLoginAuthoritySelect
      v-model="authority"
      :items="items"
    />
    <v-combobox
      v-if="!streamerMode"
      ref="accountInput"
      v-model="data.username"
      :items="history"
      prepend-inner-icon="person"
      outlined
      required
      :label="getUserServiceAccount(authority)"
      :rules="usernameRules"
      :error="!!errorMessage"
      :error-messages="errorMessage"
      @input="error = undefined"
      @keypress="error = undefined"
      @keypress.enter="onLogin"
    />
    <v-text-field
      v-else
      ref="accountInput"
      v-model="data.username"
      prepend-inner-icon="person"
      outlined
      required
      type="password"
      :label="getUserServiceAccount(authority)"
      :rules="usernameRules"
      :error="!!errorMessage"
      :error-messages="errorMessage"
      @input="error = undefined"
      @keypress="error = undefined"
      @keypress.enter="onLogin"
    />
    <v-text-field
      v-if="!isOffline"
      v-model="data.password"
      prepend-inner-icon="lock"
      outlined
      :type="passwordType"
      required
      :label="passwordLabel"
      :placeholder="passwordPlaceholder"
      :rules="!isPasswordReadonly ? passwordRules : []"
      :disabled="isPasswordDisabled"
      :readonly="isPasswordReadonly"
      :error="!!errorMessage"
      :error-messages="errorMessage"
      @input="error = undefined"
      @keypress.enter="onLogin"
    />
    <v-text-field
      v-else
      v-model="data.uuid"
      outlined
      prepend-inner-icon="fingerprint"
      :placeholder="uuidLabel"
      :label="uuidLabel"
      @keypress.enter="onLogin"
    />

    <div
      v-if="allowDeviceCode"
      class="flex"
    >
      <v-checkbox
        v-model="data.useDeviceCode"
        :label="t('userServices.microsoft.useDeviceCode')"
      />
    </div>

    <div
      @mouseenter="onMouseEnterLogin"
      @mouseleave="onMouseLeaveLogin"
    >
      <v-btn
        block
        :loading="isLogining && (!hovered)"
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
      <slot />
    </div>

    <div
      v-if="data.verificationUri"
      class="mt-6"
    >
      <a
        :href="data.verificationUri"
        class="border-b border-dashed border-b-current"
      >
        {{ t('login.manualLoginUrl') }}
      </a>
    </div>

    <div class="mt-4">
      <a
        v-if="authority === AUTHORITY_MICROSOFT"
        style="padding-right: 10px; z-index: 20"
        target="browser"
        href="https://my.minecraft.net/en-us/password/forgot/"
      >{{
        t("login.forgetPassword")
      }}</a>
      <a
        v-if="signUpLink"
        target="browser"
        :href="signUpLink"
      >
        {{ t("login.signupDescription") }}
        {{ t("login.signup") }}
      </a>
    </div>
  </div>
</template>

<script lang=ts setup>
import Hint from '@/components/Hint.vue'
import { useRefreshable, useService } from '@/composables'
import { useLocalStorageCacheBool } from '@/composables/cache'
import { kSupportedAuthorityMetadata } from '@/composables/yggrasil'
import { injection } from '@/util/inject'
import { AUTHORITY_DEV, AUTHORITY_MICROSOFT, AUTHORITY_MOJANG, UserException, UserServiceKey, isException } from '@xmcl/runtime-api'
import { Ref } from 'vue'
import { useAccountSystemHistory, useAuthorityItems } from '../composables/login'
import { kUserContext, useLoginValidation } from '../composables/user'
import UserLoginAuthoritySelect from './UserLoginAuthoritySelect.vue'

const props = defineProps<{
  inside: boolean
  options?: { username?: string; password?: string; microsoftUrl?: string; authority?: string; error?: string }
}>()

const emit = defineEmits(['seed', 'login'])
const streamerMode = inject('streamerMode', useLocalStorageCacheBool('streamerMode', false))

const { t } = useI18n()
const { select } = injection(kUserContext)
const { login, abortLogin, on } = useService(UserServiceKey)

// Shared data
const data = reactive({
  username: '',
  password: '',
  uuid: '',
  useDeviceCode: false,
  useFast: false,
  verificationUri: '',
})
const isOffline = computed(() => authority.value === AUTHORITY_DEV)
const isLogining = ref(false)

// Label
const getUserServiceAccount = (serv: string) => {
  if (serv === AUTHORITY_MICROSOFT) return t('userServices.microsoft.account')
  if (serv === AUTHORITY_MOJANG) return t('userServices.mojang.account')
  if (serv === AUTHORITY_DEV) return t('userServices.offline.account')
  return t('userServices.mojang.account')
}

// Authority items
const { data: services } = injection(kSupportedAuthorityMetadata)
const items = useAuthorityItems(services)

// Account history
const { authority, history } = useAccountSystemHistory()

const currentAccountSystem = computed(() => {
  return services.value?.find(a => a.authority === authority.value)
})

// Sign up link
const signUpLink = computed(() => {
  const sys = currentAccountSystem.value
  if (sys?.authority === AUTHORITY_MICROSOFT) return 'https://account.live.com/registration'
  const url = sys?.authlibInjector?.meta.links.register
  return url || ''
})

// Password data
const allowDeviceCode = computed(() => {
  return currentAccountSystem.value?.flow.includes('device-code')
})
const emailOnly = computed(() => {
  if (!currentAccountSystem.value?.authlibInjector) {
    if (authority.value === AUTHORITY_MICROSOFT) {
      return true // Microsoft account always has email-only flow
    }
  }
  return false
})
const isPasswordReadonly = computed(() => !currentAccountSystem.value?.flow.includes('password') || data.useDeviceCode)
const isPasswordDisabled = computed(() => isPasswordReadonly.value && !data.useDeviceCode)
const passwordType = computed(() => data.useDeviceCode ? 'text' : 'password')
const passwordLabel = computed(() => getUserServicePassword(authority.value))
const passwordPlaceholder = computed(() => data.useDeviceCode ? t('userServices.microsoft.deviceCodeHint') : passwordLabel.value)
const getUserServicePassword = (serv: string) => {
  if (data.useDeviceCode) return t('userServices.microsoft.deviceCode')
  if (serv === AUTHORITY_MICROSOFT) return t('userServices.microsoft.password')
  if (serv === AUTHORITY_DEV) return t('userServices.offline.password')
  return t('userServices.mojang.password')
}

// UUID label
const uuidLabel = computed(() => t('userServices.offline.uuid'))

// Event handler
on('microsoft-authorize-url', (url) => {
  data.verificationUri = url
})
on('device-code', (code) => {
  data.password = code.userCode
  data.verificationUri = code.verificationUri
})

// Rules
const {
  usernameRules,
  passwordRules,
} = useLoginValidation(emailOnly)

// Login Error
const errorMessage = computed(() => {
  const e = error.value
  if (isException(UserException, e)) {
    if (e.exception.type === 'loginInvalidCredentials') {
      return t('loginError.invalidCredentials')
    }
    if (e.exception.type === 'loginInternetNotConnected') {
      return t('loginError.badNetworkOrServer')
    }
    if (e.exception.type === 'loginGeneral') {
      if (e.message) {
        return e.message
      }
      return t('loginError.requestFailed')
    }
    if (e.exception.type === 'fetchMinecraftProfileFailed') {
      if (e.exception.errorType === 'ProfileNotFoundError' && !e.exception.developerMessage) {
        return t('loginError.noProfileForNewUser')
      }
      return t('loginError.fetchMinecraftProfileFailed', { reason: `${e.exception.errorType}, ${e.exception.developerMessage}` })
    }
    if (e.exception.type === 'userCheckGameOwnershipFailed') {
      return t('loginError.checkOwnershipFailed')
    }
    if (e.exception.type === 'userExchangeXboxTokenFailed') {
      return t('loginError.loginXboxFailed')
    }
    if (e.exception.type === 'userLoginMinecraftByXboxFailed') {
      return t('loginError.loginMinecraftByXboxFailed')
    }
    if (e.exception.type === 'loginReset') {
      return t('loginError.connectionReset')
    }
    if (e.exception.type === 'loginTimeout') {
      return t('loginError.timeout')
    }
    if (e.exception.type === 'userAcquireMicrosoftTokenFailed') {
      return t('loginError.acquireMicrosoftTokenFailed')
    }

    if (e.message) {
      return e.message
    }
  }

  if (e && typeof (e as Error).message === 'string') {
    return (e as Error).message
  }

  return e ? t('loginError.requestFailed') : ''
})

// Login
const accountInput: Ref<any> = ref(null)
const { refresh: onLogin, error } = useRefreshable(async () => {
  error.value = undefined
  accountInput.value.blur()
  await nextTick() // wait a tick to make sure username updated.
  if (isLogining.value) {
    await abortLogin()
    return
  }

  for (const rule of usernameRules.value) {
    const err = rule(data.username)
    if (err !== true) {
      throw new Error(err)
    }
  }

  if (!isPasswordReadonly.value && !isPasswordDisabled.value) {
    for (const rule of passwordRules) {
      const err = rule(data.password)
      if (err !== true) {
        throw new Error(err)
      }
    }
  }

  const index = history.value.indexOf(data.username)
  if (index === -1) {
    history.value = [data.username, ...history.value]
  }
  isLogining.value = true
  const profile = await login({
    username: data.username,
    password: data.password,
    authority: authority.value,
    properties: {
      mode: data.useDeviceCode ? 'device' : '',
      uuid: data.uuid,
    },
  }).finally(() => {
    isLogining.value = false
  })
  select(profile.id)
  emit('login', profile)
})

watch(authority, () => { emit('seed') })

// Hint state
const showDropHint = computed(() => allowDeviceCode.value && props.inside && isLogining.value)

// Hover state
const hovered = ref(false)
const onMouseEnterLogin = () => {
  hovered.value = true
}
const onMouseLeaveLogin = () => {
  hovered.value = false
}

// Reset
watch(() => props.options, (options) => {
  if (!options) {
    data.username = history.value[0] ?? ''
    data.password = ''
    data.verificationUri = ''
    error.value = undefined
  } else {
    data.username = options?.username ?? data.username
    data.verificationUri = ''
    authority.value = options?.authority ?? authority.value
    error.value = undefined
  }
}, { immediate: true })

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
