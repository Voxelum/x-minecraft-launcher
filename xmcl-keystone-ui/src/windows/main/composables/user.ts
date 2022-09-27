import { computed, onMounted, reactive, Ref, toRefs, watch } from '@vue/composition-api'
import { EMPTY_GAME_PROFILE, GameProfileAndTexture, UserProfile, UserServiceKey, YggdrasilUserServiceKey } from '@xmcl/runtime-api'
import { useI18n, useService, useServiceBusy, useServiceOnly } from '/@/composables'

const NO_USER_PROFILE: UserProfile = Object.freeze({
  selectedProfile: '',
  accessToken: '',
  authService: '',
  profileService: '',
  profiles: {},
  id: '',
  username: '',
  expiredAt: -1,
})
const NO_GAME_PROFILE: GameProfileAndTexture = Object.freeze({
  id: '',
  name: '',
  textures: { SKIN: { url: '' } },
})

export function useProfileId(userId: Ref<string>, profileId: Ref<string>) {
  const { state } = useService(UserServiceKey)
  const userProfile = computed(() => state.users[userId.value] ?? NO_USER_PROFILE)
  const gameProfile = computed(() => userProfile.value.profiles[profileId.value] ?? NO_GAME_PROFILE)
  return { userProfile, gameProfile }
}

export function useCurrentUser() {
  const { state } = useService(UserServiceKey)
  const userProfile: Ref<UserProfile> = computed(() => state.users[state.selectedUser.id] ?? NO_USER_PROFILE)
  const gameProfile: Ref<GameProfileAndTexture> = computed(() => userProfile.value.profiles[userProfile.value.selectedProfile] ?? NO_GAME_PROFILE)

  return {
    userProfile,
    gameProfile,
  }
}

export function useUsers() {
  const { state } = useService(UserServiceKey)
  const users = computed(() => Object.values(state.users))
  return { users }
}

export function useSwitchUser() {
  const { state, selectUser, removeUserProfile } = useService(UserServiceKey)
  const userId = computed(() => state.selectedUser.id)
  const profileId = computed(() => state.selectedUser.profile)

  const data = reactive({
    profileId: state.selectedUser.profile,
    userId: state.selectedUser.id,
  })
  const modified = computed(() => data.profileId !== profileId.value || data.userId !== userId.value)
  function commit() {
    return selectUser({ profileId: data.profileId, userId: data.userId })
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

export function useLoginValidation(isOffline: Ref<boolean>) {
  const { t } = useI18n()
  const nameRules = [(v: unknown) => !!v || t('loginError.requireUsername')]
  const emailRules = [
    (v: unknown) => !!v || t('loginError.requireEmail'),
    (v: string) => /^\w+([.-]?\w+)*@\w+([.-]?\w+)*(\.\w{2,3})+$/.test(v) ||
      t('loginError.illegalEmail'),
  ]
  const passwordRules = [(v: unknown) => !!v || t('loginError.requirePassword')]
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
  return {
    ...toRefs(data),
    usernameRules,
    passwordRules,
    reset,
  }
}

export function useMojangSecurityStatus() {
  const { state } = useService(UserServiceKey)
  const security = computed(() => (state.users[state.selectedUser.id]?.authService === 'mojang' ? true : true))

  return {
    security,
    refreshing: useServiceBusy(YggdrasilUserServiceKey, 'checkLocation'),
  }
}

export function useMojangSecurity(profile: Ref<UserProfile>) {
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

  const { security, refreshing } = useMojangSecurityStatus()
  const { getChallenges, checkLocation, submitChallenges } = useService(YggdrasilUserServiceKey)
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
      const sec = await checkLocation(profile.value)
      if (sec) return
      try {
        const challenges = await getChallenges(profile.value)
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
