<template>
  <v-dialog
    v-model="isShown"
    width="500"
    :persistent="false"
    transition="fade-transition"
    content-class="elevation-0"
  >
    <div
      class="flex flex-col w-full max-h-[80vh] overflow-hidden"
      data-testid="minecraft-friends-dialog"
    >
      <!-- Header -->
      <div
        class="flex items-center px-6 pt-6 pb-4"
      >
        <div class="flex items-center gap-3 flex-grow">
          <div
            class="w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0"
            style="background-color: rgba(var(--v-theme-primary), 0.12)"
          >
            <v-icon size="22" color="primary">people</v-icon>
          </div>
          <div>
            <div class="text-base font-bold tracking-tight" style="color: rgba(var(--v-theme-on-surface), 0.9);">
              {{ t('minecraftFriends.title') }}
            </div>
            <div
              v-if="scopeLabel"
              class="text-xs opacity-60"
            >
              {{ scopeLabel }}
            </div>
          </div>
        </div>
        <v-btn
          icon
          variant="text"
          size="small"
          :loading="loading"
          :title="t('shared.refresh')"
          @click="refresh(true)"
        >
          <v-icon size="18">refresh</v-icon>
        </v-btn>
      </div>

      <div class="flex-1 min-h-0 overflow-y-auto invisible-scroll px-6 pb-6 flex flex-col gap-4">
        <!-- Add friend -->
        <div class="surface-panel p-4">
          <div class="text-xs font-semibold uppercase tracking-wide opacity-60 mb-3">
            {{ t('minecraftFriends.add') }}
          </div>
          <div class="flex items-start gap-2">
            <v-text-field
              ref="addInputRef"
              v-model="newFriendName"
              data-testid="minecraft-friends-add-input"
              density="compact"
              variant="outlined"
              rounded="lg"
              hide-details="auto"
              :placeholder="t('minecraftFriends.addPlaceholder')"
              :error-messages="addError ? [addError] : []"
              @keydown.enter="onAddFriend"
            />
            <v-btn
              data-testid="minecraft-friends-add-button"
              color="primary"
              rounded="lg"
              :loading="adding"
              :disabled="!newFriendName.trim()"
              @click="onAddFriend"
            >
              <v-icon start size="18">person_add</v-icon>
              {{ t('minecraftFriends.send') }}
            </v-btn>
          </div>
        </div>

        <v-alert v-if="loadError" type="error" variant="tonal" density="compact" rounded="lg">
          <div class="flex items-center gap-3">
            <span class="flex-grow">{{ loadError }}</span>
            <v-btn
              v-if="isAuthError"
              size="small"
              color="error"
              variant="flat"
              rounded="lg"
              data-testid="minecraft-friends-load-error-reconnect"
              @click="onReconnect"
            >
              <v-icon start>login</v-icon>
              {{ t('minecraftFriends.reconnectAction') }}
            </v-btn>
          </div>
        </v-alert>

        <!-- Accept invites toggle -->
        <div class="surface-panel flex items-center justify-between px-4 py-3">
          <div class="flex flex-col gap-0.5">
            <div class="text-sm font-medium">{{ t('minecraftFriends.privacy.acceptInvites') }}</div>
            <div class="text-xs opacity-50">{{ t('minecraftFriends.privacy.acceptInvitesHint') }}</div>
          </div>
          <v-switch
            :model-value="preferences?.acceptInvites ?? true"
            color="primary"
            density="compact"
            hide-details
            :loading="preferencesLoading"
            :disabled="preferencesLoading"
            @update:model-value="setPreferences({ acceptInvites: $event as boolean })"
          />
        </div>

        <!-- Hero empty state -->
        <div
          v-if="isHeroEmpty"
          class="flex flex-col items-center text-center gap-2 py-8"
          data-testid="minecraft-friends-hero-empty"
        >
          <v-icon size="48" color="primary" class="opacity-50">group_add</v-icon>
          <div class="text-sm font-semibold mt-1" style="color: rgba(var(--v-theme-on-surface), 0.7);">
            {{ t('minecraftFriends.heroEmptyTitle') }}
          </div>
          <div class="text-xs max-w-[300px]" style="color: rgba(var(--v-theme-on-surface), 0.45);">
            {{ t('minecraftFriends.heroEmptyHint') }}
          </div>
        </div>

        <!-- Incoming requests -->
        <div
          v-if="!isHeroEmpty && data?.incomingRequests.length"
          class="surface-panel overflow-hidden"
        >
          <div class="px-4 pt-3 pb-2 text-xs font-semibold uppercase tracking-wide opacity-60">
            {{ t('minecraftFriends.incoming') }}
            <span class="text-primary">({{ data.incomingRequests.length }})</span>
          </div>
          <div data-testid="minecraft-friends-incoming-list">
            <div
              v-for="f of data.incomingRequests"
              :key="f.profileId"
              class="flex items-center gap-3 px-4 py-2.5 hover:bg-[rgba(var(--v-theme-on-surface),0.04)] transition-colors"
            >
              <v-avatar size="32" color="grey-darken-3">
                <img
                  :src="`https://mc-heads.net/avatar/${f.profileId}/32`"
                  :alt="f.name"
                  width="32"
                  height="32"
                  style="image-rendering: pixelated"
                  @error="($event.target as HTMLImageElement).style.display = 'none'"
                >
              </v-avatar>
              <span class="text-sm font-medium flex-grow truncate">{{ f.name }}</span>
              <div class="flex gap-1">
                <v-btn
                  size="small"
                  color="primary"
                  variant="tonal"
                  rounded="lg"
                  :loading="busy[f.profileId] === 'accept'"
                  :disabled="!!busy[f.profileId]"
                  @click="onAccept(f)"
                >
                  <v-icon start size="16">check</v-icon>
                  {{ t('minecraftFriends.accept') }}
                </v-btn>
                <v-btn
                  size="small"
                  variant="text"
                  rounded="lg"
                  :loading="busy[f.profileId] === 'decline'"
                  :disabled="!!busy[f.profileId]"
                  @click="onDecline(f)"
                >
                  <v-icon size="16">close</v-icon>
                </v-btn>
              </div>
            </div>
          </div>
        </div>

        <!-- Outgoing requests -->
        <div
          v-if="!isHeroEmpty && data?.outgoingRequests.length"
          class="surface-panel overflow-hidden"
        >
          <div class="px-4 pt-3 pb-2 text-xs font-semibold uppercase tracking-wide opacity-60">
            {{ t('minecraftFriends.outgoing') }}
            <span class="opacity-80">({{ data.outgoingRequests.length }})</span>
          </div>
          <div data-testid="minecraft-friends-outgoing-list">
            <div
              v-for="f of data.outgoingRequests"
              :key="f.profileId"
              class="flex items-center gap-3 px-4 py-2.5 hover:bg-[rgba(var(--v-theme-on-surface),0.04)] transition-colors"
            >
              <v-avatar size="32" color="grey-darken-3">
                <img
                  :src="`https://mc-heads.net/avatar/${f.profileId}/32`"
                  :alt="f.name"
                  width="32"
                  height="32"
                  style="image-rendering: pixelated"
                  @error="($event.target as HTMLImageElement).style.display = 'none'"
                >
              </v-avatar>
              <span class="text-sm font-medium flex-grow truncate">{{ f.name }}</span>
              <v-btn
                size="small"
                variant="text"
                rounded="lg"
                :loading="busy[f.profileId] === 'revoke'"
                :disabled="!!busy[f.profileId]"
                @click="onRevoke(f)"
              >
                <v-icon start size="16">undo</v-icon>
                {{ t('shared.cancel') }}
              </v-btn>
            </div>
          </div>
        </div>
      </div>
    </div>
  </v-dialog>
</template>

<script lang="ts" setup>
import { useService } from '@/composables'
import { useDialog } from '@/composables/dialog'
import {
  kMinecraftFriends,
} from '@/composables/minecraftFriends'
import { useNotifier } from '@/composables/notifier'
import { useUserMenuControl } from '@/composables/userMenu'
import { injection } from '@/util/inject'
import {
  type MinecraftFriend,
  MinecraftFriendsServiceKey,
} from '@xmcl/runtime-api'
import { computed, nextTick, ref } from 'vue'

const { t } = useI18n()
const friendsService = useService(MinecraftFriendsServiceKey)
const { notify } = useNotifier()
const { data, loading, error, refresh, userProfile, preferences, preferencesLoading, setPreferences } =
  injection(kMinecraftFriends)
const userMenu = useUserMenuControl()

const addInputRef = ref<{ focus: () => void } | null>(null)
const focusAddInput = async () => {
  await nextTick()
  addInputRef.value?.focus?.()
}

const { isShown, hide } = useDialog('minecraft-friends', () => {
  refresh(false)
  focusAddInput()
})

const adding = ref(false)
const addError = ref('')
const newFriendName = ref('')
const busy = ref<Record<string, 'accept' | 'decline' | 'revoke' | undefined>>({})

const loadError = computed(() => error.value ? formatError(error.value) : '')
const isAuthError = computed(() => {
  const e = error.value as Error | undefined
  return !!e && (e.name === 'UserAuthenticationError' || e.name === 'TokenExpiredError')
})
const onReconnect = () => {
  hide()
  userMenu.show('login')
}

const scopeLabel = computed(() => {
  const u = userProfile.value
  if (!u) return ''
  const gameName = u.profiles?.[u.selectedProfile]?.name
  const display = gameName || u.username
  if (!display) return ''
  return t('minecraftFriends.scopedTo', { name: display })
})

const isHeroEmpty = computed(() => {
  if (loading.value || loadError.value) return false
  const d = data.value
  if (!d) return false
  return d.incomingRequests.length === 0 &&
    d.outgoingRequests.length === 0
})

async function onAddFriend() {
  const name = newFriendName.value.trim()
  if (!name || !userProfile.value) return
  adding.value = true
  addError.value = ''
  try {
    await friendsService.addFriendByName(userProfile.value, name)
    newFriendName.value = ''
    notify({ title: t('minecraftFriends.notifyAdded', { name }), level: 'success' })
    await refresh(true)
    focusAddInput()
  } catch (e) {
    addError.value = formatError(e)
  } finally {
    adding.value = false
  }
}

async function withBusy(friend: MinecraftFriend, kind: 'accept' | 'decline' | 'revoke', op: () => Promise<void>) {
  busy.value = { ...busy.value, [friend.profileId]: kind }
  try {
    await op()
    await refresh(true)
  } catch (e) {
    notify({ title: formatError(e), level: 'error' })
  } finally {
    const next = { ...busy.value }
    delete next[friend.profileId]
    busy.value = next
  }
}

const onAccept = (f: MinecraftFriend) => withBusy(f, 'accept', () => friendsService.acceptFriendRequest(userProfile.value, f.profileId))
const onDecline = (f: MinecraftFriend) => withBusy(f, 'decline', () => friendsService.declineFriendRequest(userProfile.value, f.profileId))
const onRevoke = (f: MinecraftFriend) => withBusy(f, 'revoke', () => friendsService.revokeFriendRequest(userProfile.value, f.profileId))

function formatError(e: unknown): string {
  if (!e) return ''
  if (e instanceof Error || (typeof e === 'object' && e !== null && 'message' in e && typeof (e as any).message === 'string')) {
    const sub = (e as any).subStatus as string | undefined
    if (sub) {
      switch (sub) {
        case 'UNKNOWN_PROFILE': return t('minecraftFriends.errors.unknownProfile')
        case 'CANNOT_ADD_SELF': return t('minecraftFriends.errors.cannotAddSelf')
        case 'DUPLICATED_PROFILES': return t('minecraftFriends.errors.duplicate')
        case 'INVITE_REJECTED': return t('minecraftFriends.errors.inviteRejected')
      }
    }
    const err = e as Error
    if (err.name === 'UserAuthenticationError') return t('minecraftFriends.errors.tokenExpired')
    if (err.name === 'MinecraftFriendsUnsupportedError') return t('minecraftFriends.unsupported')
    return err.message || t('minecraftFriends.errors.generic')
  }
  return String(e)
}
</script>
