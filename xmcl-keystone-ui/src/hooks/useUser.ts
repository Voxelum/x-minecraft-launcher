import { computed, onMounted, reactive, Ref, toRefs, watch } from '@vue/composition-api'
import { GameProfile } from '@xmcl/user'
import { useI18n } from './useI18n'
import { useSelectedServices } from './useLoginAccounts'
import { useBusy } from './useSemaphore'
import { useService, useServiceOnly } from './useService'
import { LoginException, EMPTY_GAME_PROFILE, UserProfile, UserServiceKey } from '@xmcl/runtime-api'

export function useUserService() {
  return useService(UserServiceKey)
}

export function useGameProfile(gameProfile: Ref<GameProfile>) {
  const name = computed(() => gameProfile.value.name)
  const id = computed(() => gameProfile.value.id)
  return { name, id }
}

export function useUserProfile(userProfile: Ref<UserProfile>) {
  const { state } = useUserService()
  const profileService = computed(() => ({ ...state.profileServices[userProfile.value.profileService], name: userProfile.value.profileService }))
  const authService = computed(() => ({ ...state.authServices[userProfile.value.authService], name: userProfile.value.authService }))
  const accessToken = computed(() => userProfile.value.accessToken)
  const username = computed(() => userProfile.value.username)
  const profiles = computed(() => userProfile.value.profiles)
  const id = computed(() => userProfile.value.id)
  return {
    profileService,
    authService,
    accessToken,
    username,
    profiles,
    id,
  }
}

export function useUserProfileStatus(userProfile: Ref<UserProfile>) {
  const accessTokenValid = computed(() => userProfile.value.accessToken !== '')
  const offline = computed(() => userProfile.value.authService === 'offline')
  const isServiceCompatible = computed(() => userProfile.value.authService === userProfile.value.profileService)
  return {
    accessTokenValid,
    offline,
    isServiceCompatible,
    logined: accessTokenValid,
  }
}

const NO_USER_PROFILE: UserProfile = Object.freeze({
  selectedProfile: '',
  accessToken: '',
  authService: '',
  profileService: '',
  profiles: {},
  id: '',
  username: '',
})
const NO_GAME_PROFILE: GameProfile = Object.freeze({
  id: '',
  name: '',
})

export function useSelectedUser() {
  const { state } = useUserService()
  const userId = computed(() => state.selectedUser.id)
  const profileId = computed(() => state.selectedUser.profile)
  return { userId, profileId }
}

export function useProfileId(userId: Ref<string>, profileId: Ref<string>) {
  const { state } = useUserService()
  const userProfile = computed(() => state.users[userId.value] ?? NO_USER_PROFILE)
  const gameProfile = computed(() => userProfile.value.profiles[profileId.value] ?? NO_GAME_PROFILE)
  return { userProfile, gameProfile }
}

export function useCurrentUser() {
  const { state } = useUserService()
  const { userId, profileId } = useSelectedUser()
  const userProfile: Ref<UserProfile> = computed(() => state.users[userId.value] ?? NO_USER_PROFILE)
  const gameProfile: Ref<GameProfile> = computed(() => userProfile.value.profiles[profileId.value] ?? NO_GAME_PROFILE)

  /**
     * selected profile id
     */
  return {
    userId,
    profileId,
    userProfile,
    gameProfile,
    ...useServiceOnly(UserServiceKey, 'refreshStatus', 'switchUserProfile', 'logout', 'refreshSkin'),
  }
}

export function useUserSkin(userId: Ref<string>, gameProfileId: Ref<string>) {
  const { state } = useUserService()
  const { refreshSkin, uploadSkin, saveSkin } = useServiceOnly(UserServiceKey, 'refreshSkin', 'uploadSkin', 'saveSkin')
  const data = reactive({
    url: '',
    slim: false,
    loading: false,
  })
  const gameProfile = computed(() => state.users[userId.value]?.profiles[gameProfileId.value] || EMPTY_GAME_PROFILE)
  function reset() {
    console.log('reset')
    data.url = gameProfile.value.textures.SKIN.url
    data.slim = gameProfile.value.textures.SKIN.metadata ? gameProfile.value.textures.SKIN.metadata.model === 'slim' : false
  }
  const modified = computed(() => data.url !== gameProfile.value.textures.SKIN.url ||
    data.slim !== (gameProfile.value.textures.SKIN.metadata ? gameProfile.value.textures.SKIN.metadata.model === 'slim' : false))
  async function save() {
    data.loading = true
    try {
      await uploadSkin({ url: data.url, slim: data.slim })
      await refreshSkin({ userId: userId.value, gameProfileId: gameProfileId.value }).then(() => reset())
    } finally {
      data.loading = false
    }
  }
  onMounted(() => {
    refreshSkin({ userId: userId.value, gameProfileId: gameProfileId.value }).then(() => reset())
    reset()
  })
  function refresh() {
    refreshSkin({ userId: userId.value, gameProfileId: gameProfileId.value, force: true })
  }
  watch([userId, gameProfileId], () => {
    if (userId.value && gameProfileId.value) {
      refreshSkin({ userId: userId.value, gameProfileId: gameProfileId.value }).then(() => reset())
    }
    reset()
  })
  return {
    ...toRefs(data),
    refreshing: useBusy('refreshSkin()'),
    refresh,
    save,
    reset,
    modified,

    exportTo: saveSkin,
  }
}

export function useUserServices() {
  const { state } = useUserService()
  const authServices = computed(() => ['offline', ...Object.keys(state.authServices)])
  const profileServices = computed(() => Object.keys(state.profileServices))
  return {
    authServices,
    profileServices,
  }
}

export function useUsers() {
  const { state } = useUserService()
  const users = computed(() => Object.values(state.users))
  return { users }
}

export function useSwitchUser() {
  const { userId, profileId } = useSelectedUser()

  const data = reactive({
    profileId: profileId.value,
    userId: userId.value,
  })
  const modified = computed(() => data.profileId !== profileId.value || data.userId !== userId.value)
  const { switchUserProfile, removeUserProfile } = useServiceOnly(UserServiceKey, 'switchUserProfile', 'removeUserProfile')
  function commit() {
    return switchUserProfile({ profileId: data.profileId, userId: data.userId })
  }
  function select(profileId: string, userId: string) {
    data.profileId = profileId
    data.userId = userId
  }
  function remove(userId: string) {
    removeUserProfile(userId)
  }
  watch([profileId, userId], () => {
    data.profileId = profileId.value
    data.userId = userId.value
  })
  return {
    selectedUserId: userId,
    selectedProfileId: profileId,
    select,
    remove,
    commit,
    modified,
    ...toRefs(data),
  }
}

interface ServiceItem {
  text: string
  value: string
}

export function useLogin() {
  const { state, removeUserProfile, cancelMicrosoftLogin } = useUserService()
  const { $te, $t } = useI18n()
  const authServices: Ref<ServiceItem[]> = computed(() => ['microsoft', ...Object.keys(state.authServices), 'offline']
    .map((a) => ({ value: a, text: $te(`user.${a}.name`) ? $t(`user.${a}.name`) : a })))
  const profileServices: Ref<ServiceItem[]> = computed(() => Object.keys(state.profileServices)
    .map((a) => ({ value: a, text: $te(`user.${a}.name`) ? $t(`user.${a}.name`) : a })))
  const { userId, profileId, userProfile } = useCurrentUser()
  const { username } = useUserProfile(userProfile)
  const { logined } = useUserProfileStatus(userProfile)
  const { login } = useServiceOnly(UserServiceKey, 'login', 'switchUserProfile')
  const { profileService, authService, history } = useSelectedServices()

  const _authService = computed<ServiceItem>({
    get() { return authServices.value.find(a => a.value === authService.value)! },
    set(v) { authService.value = v as any as string },
  })
  const _profileService = computed<ServiceItem>({
    get() { return profileServices.value.find(a => a.value === profileService.value)! },
    set(v) { profileService.value = v as any as string },
  })

  const logining = useBusy('login()')

  const data = reactive({
    username: '',
    password: '',
    selectProfile: true,
  })
  async function _login() {
    const index = history.value.indexOf(data.username)
    if (index === -1) {
      history.value.unshift(data.username)
    }
    await login({ ...data, authService: authService.value, profileService: profileService.value })
  }
  function remove(userId: string) {
    removeUserProfile(userId)
  }
  function reset() {
    data.username = history.value[0] ?? ''
    data.password = ''
  }
  onMounted(() => {
    reset()
  })
  return {
    ...toRefs(data),
    cancelMicrosoftLogin,
    logining,
    logined,
    login: _login,
    reset,
    remove,
    authService: _authService,
    profileService: _profileService,
    history,

    selectedProfile: profileId,
    selectedUser: userId,

    authServices,
    profileServices,
  }
}

export function useLoginValidation(isOffline: Ref<boolean>) {
  const { $t } = useI18n()
  const nameRules = [(v: unknown) => !!v || $t('user.requireUsername')]
  const emailRules = [
    (v: unknown) => !!v || $t('user.requireEmail'),
    (v: string) => /^\w+([.-]?\w+)*@\w+([.-]?\w+)*(\.\w{2,3})+$/.test(v) ||
      $t('user.illegalEmail'),
  ]
  const passwordRules = [(v: unknown) => !!v || $t('user.requirePassword')]
  const usernameRules = computed(() => (isOffline.value
    ? nameRules
    : emailRules))
  const data = reactive({
    usernameErrors: [] as string[],
    passwordErrors: [] as string[],
  })
  function reset() {
    data.usernameErrors = []
    data.passwordErrors = []
  }
  function handleError(e: LoginException) {
    if (e.type === 'loginInternetNotConnected') {
      // TODO: handle this case
    } else if (e.type === 'loginInvalidCredentials') {
      const msg = $t('user.invalidCredentials')
      data.usernameErrors = [msg]
      data.passwordErrors = [msg]
    } else {
      const err = e as any
      data.usernameErrors = [err.message ?? err.errorMessage]
      console.error(e)
    }
  }
  return {
    ...toRefs(data),
    usernameRules,
    passwordRules,
    reset,
    handleError,
  }
}

export function useUserSecurityStatus() {
  const { state } = useUserService()
  const security = computed(() => (state.users[state.selectedUser.id]?.authService === 'mojang' ? state.mojangSecurity : true))

  return {
    security,
    refreshing: useBusy('checkLocation()'),
  }
}

export function useUserSecurity() {
  interface MojangChallenge {
    readonly answer: {
      id: number
      answer: string
    }
    readonly question: {
      id: number
      question: string
    }
  }

  const { security, refreshing } = useUserSecurityStatus()
  const { getChallenges, checkLocation, submitChallenges } = useServiceOnly(UserServiceKey, 'getChallenges', 'checkLocation', 'submitChallenges')
  const data = reactive({
    loading: false,
    challenges: [] as MojangChallenge[],
    error: undefined as any,
  })
  async function check() {
    try {
      if (data.loading) return
      if (data.challenges.length > 0) return
      data.loading = true
      const sec = await checkLocation()
      if (sec) return
      try {
        const challenges = await getChallenges()
        data.challenges = challenges.map(c => ({ question: c.question, answer: { id: c.answer.id, answer: '' } }))
      } catch (e) {
        data.error = e
      }
    } finally {
      data.loading = false
    }
  }
  async function submit() {
    data.loading = true
    try {
      await submitChallenges(data.challenges.map(c => c.answer))
    } catch (e) {
      data.error = e
    } finally {
      data.loading = false
    }
  }
  return {
    ...toRefs(data),
    refreshing,
    security,
    check,
    submit,
  }
}
