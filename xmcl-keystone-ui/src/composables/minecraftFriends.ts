import { computed, InjectionKey, onScopeDispose, ref, Ref, shallowRef, watch } from 'vue'
import {
  AUTHORITY_MICROSOFT,
  type MinecraftFriendsList,
  type MinecraftFriendsPreferences,
  MinecraftFriendsServiceKey,
  type UserProfile,
} from '@xmcl/runtime-api'
import { useService } from '@/composables'
import { kUserContext } from '@/composables/user'
import { injection } from '@/util/inject'

export const kMinecraftFriends: InjectionKey<ReturnType<typeof useMinecraftFriendsImpl>> =
  Symbol('MinecraftFriends')

/**
 * Shared state for Minecraft friends. Owns the friends payload for the
 * currently-selected user, exposes derived counters for badges and a
 * `refresh` action that takes care of caching + error handling.
 *
 * Should be `provide`d once (at the App root) and consumed via
 * `injection(kMinecraftFriends)` everywhere else so the dialog, the
 * sidebar avatar badge and the user popover all read the same data.
 */
export function useMinecraftFriendsImpl(userContext?: { userProfile: Ref<UserProfile> }) {
  const { userProfile } = userContext || injection(kUserContext)
  const friendsService = useService(MinecraftFriendsServiceKey)

  const data = shallowRef<MinecraftFriendsList | undefined>()
  const loading = ref(false)
  const error = ref<unknown>()
  const preferences = ref<MinecraftFriendsPreferences | undefined>()
  const preferencesLoading = ref(false)

  const isMicrosoftUser = computed(() => userProfile.value?.authority === AUTHORITY_MICROSOFT)
  const incomingCount = computed(() => data.value?.incomingRequests.length ?? 0)
  const outgoingCount = computed(() => data.value?.outgoingRequests.length ?? 0)
  const friendsCount = computed(() => data.value?.friends.length ?? 0)
  const fetchedAt = computed(() => data.value?.fetchedAt ?? 0)

  let lastFetchedUserId: string | undefined

  async function refresh(force = false) {
    if (!isMicrosoftUser.value || !userProfile.value?.id) {
      data.value = undefined
      return
    }
    loading.value = true
    error.value = undefined
    try {
      data.value = await friendsService.getFriends(userProfile.value, force)
      lastFetchedUserId = userProfile.value.id
    } catch (e) {
      error.value = e
    } finally {
      loading.value = false
    }
  }

  // Reset / refresh when the active user changes.
  watch(() => userProfile.value?.id, (id) => {
    if (id !== lastFetchedUserId) data.value = undefined
    if (isMicrosoftUser.value) {
      refresh(false)
      refreshPreferences()
    } else {
      preferences.value = undefined
    }
  })

  async function refreshPreferences() {
    if (!isMicrosoftUser.value || !userProfile.value?.id) {
      preferences.value = undefined
      return
    }
    preferencesLoading.value = true
    try {
      preferences.value = await friendsService.getFriendsPreferences(userProfile.value)
    } catch {
      // non-critical – ignore silently
    } finally {
      preferencesLoading.value = false
    }
  }

  async function setPreferences(prefs: Partial<MinecraftFriendsPreferences>) {
    if (!isMicrosoftUser.value || !userProfile.value?.id) return
    preferencesLoading.value = true
    try {
      preferences.value = await friendsService.setFriendsPreferences(userProfile.value, prefs)
    } catch (e) {
      error.value = e
    } finally {
      preferencesLoading.value = false
    }
  }

  // Background polling: keep the incoming-request count fresh while the
  // launcher window is visible so the system-bar badge updates without the
  // user opening the popover. The backend service already caches per
  // ~10s + uses conditional GETs, so a 60s tick is cheap on the network.
  const POLL_INTERVAL_MS = 60_000
  let pollHandle: number | undefined
  const startPolling = () => {
    if (pollHandle !== undefined) return
    pollHandle = window.setInterval(() => {
      if (document.visibilityState !== 'visible') return
      if (isMicrosoftUser.value) refresh(false)
    }, POLL_INTERVAL_MS)
  }
  const stopPolling = () => {
    if (pollHandle === undefined) return
    window.clearInterval(pollHandle)
    pollHandle = undefined
  }
  const onVisibilityChange = () => {
    if (document.visibilityState === 'visible' && isMicrosoftUser.value) {
      refresh(false)
    }
  }
  startPolling()
  document.addEventListener('visibilitychange', onVisibilityChange)
  onScopeDispose(() => {
    stopPolling()
    document.removeEventListener('visibilitychange', onVisibilityChange)
  })

  return {
    data,
    loading,
    error,
    isMicrosoftUser,
    incomingCount,
    outgoingCount,
    friendsCount,
    fetchedAt,
    refresh,
    userProfile,
    preferences,
    preferencesLoading,
    refreshPreferences,
    setPreferences,
  }
}

/**
 * A reactive `now` ref that ticks every `intervalMs` ms. Use together with
 * {@link formatRelativeTime} to render auto-updating "X minutes ago"
 * labels without burning a render every second.
 */
export function useReactiveNow(intervalMs = 30_000) {
  const now = ref(Date.now())
  const handle = window.setInterval(() => {
    now.value = Date.now()
  }, intervalMs)
  onScopeDispose(() => window.clearInterval(handle))
  return now
}

/**
 * Format a `then` timestamp relative to `now`, returning an i18n key and a
 * `count` parameter so the caller can wrap it with `t(...)`. Returns
 * `undefined` for falsy timestamps so callers can render an empty label.
 */
export function formatRelativeTime(
  then: number,
  now = Date.now(),
): { key: string; count: number } | undefined {
  if (!then) return undefined
  const diff = Math.max(0, now - then)
  const sec = Math.floor(diff / 1000)
  if (sec < 5) return { key: 'relative.justNow', count: 0 }
  if (sec < 60) return { key: 'relative.secondsAgo', count: sec }
  const min = Math.floor(sec / 60)
  if (min < 60) return { key: 'relative.minutesAgo', count: min }
  const hr = Math.floor(min / 60)
  if (hr < 24) return { key: 'relative.hoursAgo', count: hr }
  const day = Math.floor(hr / 24)
  return { key: 'relative.daysAgo', count: day }
}
