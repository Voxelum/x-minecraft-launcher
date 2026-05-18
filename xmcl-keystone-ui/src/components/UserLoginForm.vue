<template>
  <Hint
    v-if="showDropHint"
    icon="save_alt"
    :text="t('login.dropHint').toString()"
    class="text-lg font-medium tracking-wide drop-shadow-md"
  />
  <div
    v-else
    class="login-form-container overflow-auto mx-auto w-full h-full max-w-md px-6 py-8 flex flex-col"
  >
    <!-- Header / Branding Area -->
    <div class="login-form-branding flex flex-col items-center mb-2">
      <div
        class="w-16 h-16 rounded-2xl flex items-center justify-center mb-4 flex-shrink-0"
        style="background-color: rgba(var(--v-theme-primary), 0.12)"
      >
        <v-icon size="32" color="primary">person</v-icon>
      </div>
    </div>

    <UserLoginAuthoritySelect
      v-model="authority"
      class="flex-grow-0"
      data-testid="login-authority"
      :items="items"
      density="default"
      hide-details
      @add-service="$emit('add-service')"
    />
    <v-combobox
      v-if="!streamerMode"
      ref="accountInput"
      class="flex-grow-0"
      v-model="data.username"
      data-testid="login-username"
      :items="history"
      prepend-inner-icon="person"
      variant="outlined"
      density="comfortable"
      rounded="lg"
      required
      :label="getUserServiceAccount(authority)"
      :rules="usernameRules"
      :error="!!errorMessage"
      hide-details="auto"
      @update:model-value="error = undefined"
      @keypress="error = undefined"
      @keypress.enter="onLogin"
    />
    <v-text-field
      v-else
      ref="accountInput"
      class="flex-grow-0"
      v-model="data.username"
      data-testid="login-username"
      prepend-inner-icon="person"
      variant="outlined"
      density="comfortable"
      rounded="lg"
      required
      type="password"
      :label="getUserServiceAccount(authority)"
      :rules="usernameRules"
      :error="!!errorMessage"
      hide-details="auto"
      @update:model-value="error = undefined"
      @keypress="error = undefined"
      @keypress.enter="onLogin"
    />
    <v-text-field
      v-if="!isOffline"
      v-model="data.password"
      data-testid="login-password"
      class="flex-grow-0"
      prepend-inner-icon="lock"
      variant="outlined"
      density="comfortable"
      rounded="lg"
      :type="passwordType"
      required
      :label="passwordLabel"
      :placeholder="passwordPlaceholder"
      :rules="!isPasswordReadonly ? passwordRules : []"
      :disabled="isPasswordDisabled"
      :readonly="isPasswordReadonly"
      :error="!!errorMessage"
      hide-details="auto"
      @update:model-value="error = undefined"
      @keypress.enter="onLogin"
    />
    <v-text-field
      v-else
      v-model="data.uuid"
      class="flex-grow-0"
      variant="outlined"
      density="comfortable"
      prepend-inner-icon="fingerprint"
      :placeholder="uuidLabel"
      :label="uuidLabel"
      hide-details
      @keypress.enter="onLogin"
    />

    <v-alert
      v-if="errorMessage"
      density="compact"
      variant="tonal"
      color="error"
      rounded="lg"
      class="text-left text-sm"
    >
      {{ errorMessage }}
    </v-alert>

    <v-checkbox
      v-if="allowDeviceCode"
      v-model="data.useDeviceCode"
      density="compact"
      hide-details
      color="primary"
      :label="t('userServices.microsoft.useDeviceCode')"
    />

    <div class="flex-grow" />

    <div @mouseenter="onMouseEnterLogin" @mouseleave="onMouseLeaveLogin">
      <v-btn
        block
        data-testid="login-submit"
        size="x-large"
        rounded="xl"
        class="text-white font-bold tracking-wider shadow-[0_10px_25px_-8px_rgba(var(--v-theme-primary),0.6)] hover:shadow-[0_15px_30px_-8px_rgba(var(--v-theme-primary),0.8)] transform hover:-translate-y-0.5 active:translate-y-0 transition-all duration-300"
        style="
          background: linear-gradient(
            to right,
            rgb(var(--v-theme-primary)),
            rgba(var(--v-theme-primary), 0.7)
          );
        "
        :loading="isLogining && !hovered"
        :prepend-icon="isLogining ? undefined : 'login'"
        @click="onLogin"
      >
        <template v-if="!isLogining">
          {{ t('login.login') }}
        </template>
        <template v-else>
          <v-icon start>close</v-icon>
          {{ t('shared.cancel') }}
        </template>
      </v-btn>
      <slot />
    </div>

    <v-alert
      v-if="data.verificationUri"
      density="compact"
      variant="tonal"
      color="info"
      rounded="lg"
      class="mt-3 text-left border border-info/30"
    >
      <a
        :href="data.verificationUri"
        target="browser"
        class="text-info underline break-all text-sm font-medium hover:text-info-dark transition-colors"
      >
        {{ t('login.manualLoginUrl') }}
      </a>
    </v-alert>

    <div class="mt-4 flex flex-col gap-3 items-center text-sm font-medium">
      <a
        v-if="authority === AUTHORITY_MICROSOFT"
        target="browser"
        href="https://my.minecraft.net/en-us/password/forgot/"
        class="hover:underline transition-colors opacity-70 hover:opacity-100"
        style="color: rgba(var(--v-theme-on-surface), 0.8)"
      >
        {{ t('login.forgetPassword') }}
      </a>
      <div
        v-if="signUpLink"
        class="flex items-center gap-3 flex-wrap justify-center py-2 px-4 rounded-xl border w-full backdrop-blur-sm"
        style="
          background: rgba(var(--v-theme-on-surface), 0.03);
          border-color: rgba(var(--v-theme-on-surface), 0.08);
        "
      >
        <a
          target="browser"
          :href="signUpLink"
          class="hover:underline transition-colors opacity-70 hover:opacity-100"
          style="color: rgba(var(--v-theme-on-surface), 0.8)"
        >
          {{ t('login.signupDescription') }}
          {{ t('login.signup') }}
        </a>
        <span class="opacity-30" style="color: rgba(var(--v-theme-on-surface), 0.5)">|</span>
        <a
          class="hover:underline cursor-pointer transition-colors opacity-70 hover:opacity-100"
          style="color: rgba(var(--v-theme-on-surface), 0.8)"
          @click.stop="$emit('add-service')"
        >
          {{ manageAuthorityLabel }}
        </a>
      </div>
    </div>
  </div>
</template>

<script lang="ts" setup>
import Hint from '@/components/Hint.vue'
import { useRefreshable, useService } from '@/composables'
import { useLocalStorageCacheBool } from '@/composables/cache'
import { kSupportedAuthorityMetadata } from '@/composables/yggrasil'
import { injection } from '@/util/inject'
import {
  AUTHORITY_DEV,
  AUTHORITY_MICROSOFT,
  AUTHORITY_MOJANG,
  UserException,
  UserServiceKey,
  isException,
} from '@xmcl/runtime-api'
import { Ref } from 'vue'
import { useAccountSystemHistory, useAuthorityItems } from '../composables/login'
import { kUserContext, useLoginValidation } from '../composables/user'
import UserLoginAuthoritySelect from './UserLoginAuthoritySelect.vue'

const props = defineProps<{
  inside: boolean
  options?: {
    username?: string
    password?: string
    microsoftUrl?: string
    authority?: string
    error?: string
  }
}>()

const emit = defineEmits(['seed', 'login', 'add-service'])
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
  return services.value?.find((a) => a.authority === authority.value)
})

// Sign up link
const signUpLink = computed(() => {
  const sys = currentAccountSystem.value
  if (sys?.authority === AUTHORITY_MICROSOFT) return 'https://account.live.com/registration'
  const url = sys?.authlibInjector?.meta.links.register
  return url || ''
})

const manageAuthorityLabel = computed(() => t('userService.manageServices'))

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
const isPasswordReadonly = computed(
  () => !currentAccountSystem.value?.flow.includes('password') || data.useDeviceCode,
)
const isPasswordDisabled = computed(() => isPasswordReadonly.value && !data.useDeviceCode)
const passwordType = computed(() => (data.useDeviceCode ? 'text' : 'password'))
const passwordLabel = computed(() => getUserServicePassword(authority.value))
const passwordPlaceholder = computed(() =>
  data.useDeviceCode ? t('userServices.microsoft.deviceCodeHint') : passwordLabel.value,
)
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
const { usernameRules, passwordRules } = useLoginValidation(emailOnly, isOffline)

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
      return t('loginError.fetchMinecraftProfileFailed', {
        reason: `${e.exception.errorType}, ${e.exception.developerMessage}`,
      })
    }
    if (e.exception.type === 'userCheckGameOwnershipFailed') {
      return t('loginError.checkOwnershipFailed')
    }
    if (e.exception.type === 'userExchangeXboxTokenFailed') {
      const redirect = e.exception.xErrRedirect
      // New granular reasons take precedence; legacy reasons fall through
      // to the existing strings. Where Microsoft returns a fix-it URL
      // (e.g. AddChildToFamily, CreateAccount), pass it through so the
      // user can click straight to the resolution.
      switch (e.exception.reason) {
        case 'CHILD_ACCOUNT':
          return t('loginError.loginXboxChildAccount', { url: redirect ?? 'https://start.ui.xboxlive.com/AddChildToFamily' })
        case 'NO_XBOX_PROFILE':
        case 'NO_ACCOUNT':
          return t('loginError.loginXboxNoXboxProfile', { url: redirect ?? 'https://start.ui.xboxlive.com/CreateAccount' })
        case 'ADULT_VERIFICATION_REQUIRED':
          return t('loginError.loginXboxAdultVerification', { url: redirect ?? '' })
        case 'REGION_LOCKED':
          return t('loginError.loginXboxRegionLocked')
        case 'BANNED':
          return t('loginError.loginXboxBanned')
        case 'BAD_AGE':
          return t('loginError.loginXboxAgeRestricted')
        case 'BAD_XSTS':
          return t('loginError.loginXboxBadXsts')
      }
      // Surface the raw XErr code if we have one but no classification --
      // helps users searching the web / opening support tickets.
      if (typeof e.exception.xErr === 'number') {
        return t('loginError.loginXboxFailedWithCode', { code: e.exception.xErr })
      }
      return t('loginError.loginXboxFailed')
    }
    if (e.exception.type === 'userLoginMinecraftByXboxFailed') {
      const { status, retryAfter } = e.exception
      if (status === 429) {
        const retrySeconds = typeof retryAfter === 'number' ? Math.ceil(retryAfter / 1000) : undefined
        return retrySeconds
          ? t('loginError.loginMinecraftByXboxRateLimitedWithRetry', { seconds: retrySeconds })
          : t('loginError.loginMinecraftByXboxRateLimited')
      }
      if (typeof status === 'number' && status >= 500) {
        return t('loginError.loginMinecraftByXboxServerError', { status })
      }
      if (typeof status === 'number') {
        return t('loginError.loginMinecraftByXboxStatus', { status })
      }
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
      throw new Error(typeof err === 'string' ? err : 'Validation failed')
    }
  }

  if (!isPasswordReadonly.value && !isPasswordDisabled.value) {
    for (const rule of passwordRules) {
      const err = rule(data.password)
      if (err !== true) {
        throw new Error(typeof err === 'string' ? err : 'Validation failed')
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

watch(authority, () => {
  emit('seed')
})

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
watch(
  () => props.options,
  (options) => {
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
  },
  { immediate: true },
)
</script>

<style>
.login-form-container {
  container-type: size;
  container-name: login-form;
  gap: 1.2rem;
}

@container login-form (max-height: 480px) {
  .login-form-branding {
    display: none;
  }

  .login-form-container {
    gap: 0.5rem;
    padding-top: 1rem;
    padding-bottom: 1rem;
  }
}

@container login-form (max-height: 450px) {
  .login-form-branding {
    display: none;
  }

  .login-form-container {
    gap: 0.1rem;
    padding-top: 1rem;
    padding-bottom: 1rem;
  }
}

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
