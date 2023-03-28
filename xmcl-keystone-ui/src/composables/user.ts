import { computed, InjectionKey, reactive, Ref, toRefs } from 'vue'
import { GameProfileAndTexture, OfficialUserServiceKey, UserProfile, UserServiceKey } from '@xmcl/runtime-api'

import { useService, useServiceBusy } from '@/composables'

const NO_USER_PROFILE: UserProfile = Object.freeze({
  selectedProfile: '',
  invalidated: true,
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

export const kUserContext: InjectionKey<ReturnType<typeof useUserContext>> = Symbol('UserContext')

export function useUserContext() {
  const { state } = useService(UserServiceKey)
  const userProfile: Ref<UserProfile> = computed(() => state.users[state.selectedUser.id] ?? NO_USER_PROFILE)
  const gameProfile: Ref<GameProfileAndTexture> = computed(() => userProfile.value.profiles[userProfile.value.selectedProfile] ?? NO_GAME_PROFILE)
  const users = computed(() => Object.values(state.users))

  return {
    users,
    userProfile,
    gameProfile,
  }
}

export function useUserExpired(user: Ref<UserProfile | undefined>) {
  return computed(() => !user.value || user.value?.invalidated || user.value.expiredAt < Date.now())
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
  const security = computed(() => true)

  return {
    security,
    refreshing: useServiceBusy(OfficialUserServiceKey, 'verifySecurityLocation'),
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
  const { getSecurityChallenges: getChallenges, verifySecurityLocation: checkLocation, submitSecurityChallenges: submitChallenges } = useService(OfficialUserServiceKey)
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
