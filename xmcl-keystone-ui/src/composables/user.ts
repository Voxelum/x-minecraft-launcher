import { computed, del, InjectionKey, reactive, Ref, set, toRefs } from 'vue'
import { GameProfileAndTexture, OfficialUserServiceKey, UserProfile, UserServiceKey, UserState } from '@xmcl/runtime-api'

import { useService, useServiceBusy } from '@/composables'
import { useLocalStorageCacheStringValue } from './cache'
import { useState } from './syncableState'
import { GameProfile } from '@xmcl/user'

const NO_USER_PROFILE: UserProfile = Object.freeze({
  selectedProfile: '',
  invalidated: true,
  authority: '',
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
  const { getUserState, refreshUser } = useService(UserServiceKey)
  const { state, isValidating, error } = useState(getUserState, class extends UserState {
    override gameProfileUpdate({ profile, userId }: { userId: string; profile: (GameProfileAndTexture | GameProfile) }) {
      const userProfile = this.users[userId]
      if (profile.id in userProfile.profiles) {
        const instance = { textures: { SKIN: { url: '' } }, ...profile }
        set(userProfile.profiles, profile.id, instance)
      } else {
        userProfile.profiles[profile.id] = {
          textures: { SKIN: { url: '' } },
          ...profile,
        }
      }
    }

    override userProfileRemove(userId: string) {
      del(this.users, userId)
    }

    override userProfile(user: UserProfile) {
      if (this.users[user.id]) {
        const current = this.users[user.id]
        current.avatar = user.avatar
        current.expiredAt = user.expiredAt
        current.profiles = user.profiles
        current.username = user.username
        current.selectedProfile = user.selectedProfile
        current.invalidated = user.invalidated
      } else {
        set(this.users, user.id, user)
      }
    }
  })
  const selectedUserId = useLocalStorageCacheStringValue('selectedUserId', '' as string)
  const userProfile: Ref<UserProfile> = computed(() => state.value?.users[selectedUserId.value] ?? NO_USER_PROFILE)
  const gameProfile: Ref<GameProfileAndTexture> = computed(() => userProfile.value.profiles[userProfile.value.selectedProfile] ?? NO_GAME_PROFILE)
  const users = computed(() => Object.values(state.value?.users || {}))
  const select = (id: string) => {
    selectedUserId.value = id
  }

  watch(userProfile, (profile) => {
    if (profile === NO_USER_PROFILE) {
      // Select the first user
      const first = users.value[0]
      if (first) {
        select(first.id)
      }
    } else {
      refreshUser(profile.id)
    }
  }, { immediate: true })

  watch(state, (s) => {
    if (!s) return
    if (userProfile.value === NO_USER_PROFILE) {
      // Select the first user
      const first = users.value[0]
      if (first) {
        select(first.id)
      }
    }
  })

  return {
    users,
    isValidating,
    error,
    select,
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
  return {
    usernameRules,
    passwordRules,
  }
}

export function useMojangSecurityStatus() {
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
      await submitChallenges(profile.value, data.challenges.map(c => c.answer))
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
