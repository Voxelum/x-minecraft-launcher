<template>
  <div
    class="flex items-center justify-center flex-col flex-grow h-100vh"
  >
    <particles
      v-if="isShown"
      class="absolute w-full h-full"
      :move-direction="direction"
      :move-enabled="isShown"
      :line-linked="false"
      :move-random="true"
      :particle-size="3"
      :move-speed="6"
      :opacity-random="true"
      :hover-effect="false"
      :click-effect="false"
    />
    <hint
      v-if="showDropHint"
      icon="save_alt"
      :text="t('login.dropHint').toString()"
    />
    <div
      v-else
      class="w-100 text-center z-10"
    >
      <v-select
        v-model="accountSystemItem"
        outlined
        prepend-inner-icon="vpn_key"
        :items="accountSystemItems"
        :label="t('user.authMode')"
        flat
      >
        <!-- <template #append-outer>
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
          </template> -->
      </v-select>

      <v-combobox
        ref="accountInput"
        v-model="data.username"
        :items="history"
        prepend-inner-icon="person"
        outlined
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
        prepend-inner-icon="lock"
        outlined
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
        outlined
        prepend-inner-icon="fingerprint"
        :placeholder="uuidLabel"
        :label="uuidLabel"
        @keypress.enter="onLogin"
      />

      <v-btn
        block
        :loading="isLogining && (!hovered || authService !== 'microsoft')"
        color="primary"
        rounded
        large
        class="text-white"
        @mouseenter="onMouseEnterLogin"
        @mouseleave="onMouseLeaveLogin"
        @click="onLogin"
      >
        <span v-if="!isLogining">
          {{ t("login.login") }}
        </span>
        <v-icon v-else>
          close
        </v-icon>
      </v-btn>

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
  </div>
</template>

<script lang=ts setup>
import { Ref } from 'vue'
import { isException, OfficialUserServiceKey, UserException, UserServiceKey } from '@xmcl/runtime-api'
import { useDialog } from '../composables/dialog'
import { LoginDialog, useSelectedServices } from '../composables/login'
import { useLoginValidation } from '../composables/user'
import Hint from '@/components/Hint.vue'
import Particles from '@/components/Particles.vue'
import { useBusy, useRefreshable, useService } from '@/composables'

interface ServiceItem {
  text: string
  value: string
}

const props = defineProps<{
  inside: boolean
}>()

const { hide, isShown, parameter } = useDialog(LoginDialog)
const { te, t } = useI18n()
const { login, abortLogin, getSupportedAccountSystems } = useService(UserServiceKey)
const { on } = useService(OfficialUserServiceKey)

const data = reactive({
  username: '',
  password: '',
  uuid: '',
  microsoftUrl: '',
})

const accountInput: Ref<any> = ref(null)
const hovered = ref(false)
const accountSystems: Ref<string[]> = ref([])
const accountSystemItems: Ref<ServiceItem[]> = computed(() => accountSystems.value
  .map((a) => ({ value: a, text: te(`userServices.${a}.name`) ? t(`userServices.${a}.name`) : a })))
const accountSystemItem = computed<ServiceItem>({
  get() { return accountSystemItems.value.find(a => a.value === authService.value)! },
  set(v) { authService.value = v as any as string },
})

const { authService, history } = useSelectedServices()

const isLogining = useBusy('login')
const isMicrosoft = computed(() => authService.value === 'microsoft')
const isOffline = computed(() => authService.value === 'offline')

const passwordLabel = computed(() => (te(`userServices.${authService.value}.password`)
  ? t(`userServices.${authService.value}.password`)
  : t(`userServices.${isOffline.value ? 'offline' : 'mojang'}.password`)))
const showDropHint = computed(() => isMicrosoft.value && props.inside && isLogining.value)
const uuidLabel = computed(() => t('userServices.offline.uuid'))

const { refresh: refreshAccountSystem, refreshing: loadingAccountSystem } = useRefreshable(async () => {
  const systems = await getSupportedAccountSystems()
  accountSystems.value = systems
})

refreshAccountSystem()

const {
  usernameRules,
  usernameErrors,
  passwordRules,
  passwordErrors,
  reset: resetError,
} = useLoginValidation(isOffline)

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
      passwordErrors.value = [e.exception.error ?? msg]
    } else if (e.exception.type === 'userCheckGameOwnershipFailed') {
      const msg = t('loginError.checkOwnershipFailed')
      usernameErrors.value = [msg]
      passwordErrors.value = [e.exception.error ?? msg]
    } else if (e.exception.type === 'userExchangeXboxTokenFailed') {
      const msg = t('loginError.loginXboxFailed')
      usernameErrors.value = [msg]
      passwordErrors.value = [e.exception.error ?? msg]
    } else if (e.exception.type === 'userLoginMinecraftByXboxFailed') {
      const msg = t('loginError.loginMinecraftByXboxFailed')
      usernameErrors.value = [msg]
      passwordErrors.value = [e.exception.error ?? msg]
    } else if (e.exception.type === 'loginReset') {
      const msg = t('loginError.connectionReset')
      usernameErrors.value = [msg]
      passwordErrors.value = [msg]
    } else if (e.exception.type === 'loginTimeout') {
      const msg = t('loginError.timeout')
      usernameErrors.value = [msg]
      passwordErrors.value = [msg]
    } else if (e.exception.type === 'userAcquireMicrosoftTokenFailed') {
      const msg = t('loginError.acquireMicrosoftTokenFailed')
      usernameErrors.value = [msg]
      passwordErrors.value = [e.exception.error ?? msg]
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
  if (!parameter.value) {
    data.username = history.value[0] ?? ''
    data.password = ''
    usernameErrors.value = []
    passwordErrors.value = []
  } else {
    data.username = parameter.value?.username ?? data.username
    authService.value = parameter.value?.service ?? authService.value
    usernameErrors.value = parameter.value.error ? [parameter.value.error] : []
    passwordErrors.value = parameter.value.error ? [parameter.value.error] : []
  }
}

async function onLogin() {
  resetError()
  accountInput.value.blur()
  await nextTick() // wait a tick to make sure username updated.
  if (isLogining.value) {
    await abortLogin()
    return
  }
  const index = history.value.indexOf(data.username)
  if (index === -1) {
    history.value.unshift(data.username)
  }
  try {
    await login({
      username: data.username,
      password: data.password,
      service: authService.value,
    })
    hide()
  } catch (e) {
    handleError(e)
  }
}

const direction = ref('top')
function nextDirection() {
  const dirs = ['top', 'right', 'left', 'bottom', 'top-right', 'top-left', 'bottom-left', 'bottom-right']
  const i = Math.round(Math.random() * dirs.length)
  direction.value = dirs[i]
}
watch(authService, () => { nextDirection() })

onMounted(() => {
  reset()
})

watch(isShown, (shown) => {
  if (!shown) { return }
  if (shown) {
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
