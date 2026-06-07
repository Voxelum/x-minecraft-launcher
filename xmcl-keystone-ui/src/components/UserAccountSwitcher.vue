<template>
  <div
    class="user-account-switcher"
    :class="{ 'user-account-switcher--comfortable': comfortable }"
  >
    <v-menu
      v-model="userMenuOpen"
      :close-on-content-click="false"
      offset-y
      :min-width="comfortable ? 320 : 260"
    >
      <template #activator="{ props: menuProps }">
        <div
          v-bind="hasUsers ? menuProps : {}"
          class="user-account-switcher__identity surface-card-row flex items-center gap-3 rounded-2xl px-3 py-2.5"
          data-testid="me-user-switcher"
          role="button"
          tabindex="0"
          :aria-label="identityAriaLabel"
          :aria-haspopup="hasUsers ? 'menu' : 'dialog'"
          :aria-expanded="hasUsers ? userMenuOpen : undefined"
          @click="onIdentityClick"
          @keydown.enter.prevent="onIdentityActivate"
          @keydown.space.prevent="onIdentityActivate"
        >
          <div class="relative flex-shrink-0 group/avatar">
            <PlayerAvatar
              class="overflow-hidden rounded-full"
              :src="gameProfile?.textures?.SKIN?.url"
              :dimension="avatarDimension"
            />
            <button
              v-if="showRefresh && hasUsers"
              type="button"
              class="user-account-switcher__avatar-refresh absolute inset-0 rounded-full bg-black/50 flex items-center justify-center opacity-0 group-hover/avatar:opacity-100 transition-opacity cursor-pointer"
              :aria-label="t('shared.refresh')"
              :disabled="refreshingUser"
              @click.stop="onRefreshUser"
            >
              <v-icon size="18" color="white" aria-hidden="true" :class="{ 'animate-spin': refreshingUser }">refresh</v-icon>
            </button>
          </div>
          <div class="flex flex-col flex-grow min-w-0">
            <span class="font-bold truncate" :class="comfortable ? 'text-base' : 'text-sm'">
              {{ gameProfile?.name || t('login.login') }}
            </span>
            <span class="truncate" :class="[comfortable ? 'text-sm' : 'text-xs', currentUserExpired ? 'text-error' : 'opacity-60']">
              {{ currentUserExpired ? t('user.tokenExpired') : authorityLabel }}
            </span>
          </div>
          <v-btn
            v-if="showInlineDelete && hasUsers"
            data-testid="accounts-delete"
            icon
            variant="text"
            size="small"
            color="error"
            class="flex-shrink-0"
            :aria-label="t('userAccount.removeTitle')"
            :title="t('userAccount.removeTitle')"
            :loading="removingUser"
            @click.stop="openRemoveAccountDialog"
          >
            <v-icon size="18" aria-hidden="true">delete</v-icon>
          </v-btn>
          <v-icon size="18" class="flex-shrink-0 opacity-60" aria-hidden="true">
            {{ hasUsers ? (userMenuOpen ? 'expand_less' : 'expand_more') : 'login' }}
          </v-icon>
        </div>
      </template>

      <v-card class="overflow-hidden account-switcher-menu">
        <v-list density="compact" class="py-1" bg-color="transparent" role="menu" :aria-label="t('userAccount.add')">
          <v-list-item
            v-for="u of users"
            :key="u.id"
            data-testid="account-item"
            :class="{ 'bg-primary/10': u.id === userProfile.id }"
            class="rounded-lg mx-1 my-0.5"
            :aria-current="u.id === userProfile.id ? 'true' : undefined"
            @click="onSwitchUser(u.id)"
          >
            <template #prepend>
              <PlayerAvatar
                class="overflow-hidden rounded-full mr-3"
                :src="u.profiles[u.selectedProfile]?.textures?.SKIN?.url"
                :dimension="32"
              />
            </template>
            <v-list-item-title class="text-sm font-medium">
              {{ u.profiles[u.selectedProfile]?.name || u.username }}
            </v-list-item-title>
            <v-list-item-subtitle class="text-xs" :class="isUserExpired(u) ? 'text-error' : ''">
              {{ isUserExpired(u) ? t('user.tokenExpired') : getExpiryLabel(u) }}
            </v-list-item-subtitle>
            <template #append>
              <v-icon v-if="u.id === userProfile.id" size="16" color="primary" aria-hidden="true">check</v-icon>
            </template>
          </v-list-item>
        </v-list>
        <v-divider />
        <div class="px-2 py-2">
          <v-btn
            block
            data-testid="accounts-add"
            variant="tonal"
            color="primary"
            size="small"
            class="rounded-lg"
            @click="openAddAccountDialog"
          >
            <v-icon start size="16" aria-hidden="true">person_add</v-icon>
            {{ t('userAccount.add') }}
          </v-btn>
        </div>
      </v-card>
    </v-menu>

    <SimpleDialog
      v-model="removeDialogShown"
      :title="t('userAccount.removeTitle')"
      :width="360"
      @confirm="onRemoveUser"
    >
      {{ t('userAccount.removeDescription') }}
    </SimpleDialog>
  </div>
</template>

<script lang="ts" setup>
import PlayerAvatar from '@/components/PlayerAvatar.vue'
import SimpleDialog from '@/components/SimpleDialog.vue'
import { useService } from '@/composables'
import { kUserContext } from '@/composables/user'
import { useUserMenuControl } from '@/composables/userMenu'
import { injection } from '@/util/inject'
import { AUTHORITY_DEV, AUTHORITY_MICROSOFT, AUTHORITY_MOJANG, UserServiceKey } from '@xmcl/runtime-api'
import type { UserProfile } from '@xmcl/runtime-api'

const props = withDefaults(defineProps<{
  showRefresh?: boolean
  showInlineDelete?: boolean
  density?: 'compact' | 'comfortable'
}>(), {
  showRefresh: true,
  showInlineDelete: false,
  density: 'compact',
})

const { t } = useI18n()
const { users, userProfile, gameProfile, select } = injection(kUserContext)

const comfortable = computed(() => props.density === 'comfortable')
const hasUsers = computed(() => users.value.length > 0 && !!userProfile.value.id)
const avatarDimension = computed(() => comfortable.value ? 56 : 40)
const authorityLabel = computed(() => getAuthorityName(userProfile.value.authority))
const currentUserExpired = computed(() => hasUsers.value && (userProfile.value.invalidated || userProfile.value.expiredAt < Date.now()))
const userMenuOpen = ref(false)

const identityAriaLabel = computed(() => {
  if (!hasUsers.value) return t('login.login')
  const name = gameProfile.value?.name || ''
  const status = currentUserExpired.value ? t('user.tokenExpired') : authorityLabel.value
  return `${name} — ${status}`.trim()
})

function onIdentityActivate() {
  if (hasUsers.value) {
    userMenuOpen.value = !userMenuOpen.value
  } else {
    openAddAccountDialog()
  }
}

function getAuthorityName(authority: string) {
  switch (authority) {
    case AUTHORITY_MICROSOFT: return t('userServices.microsoft.name')
    case AUTHORITY_MOJANG: return t('userServices.mojang.name')
    case AUTHORITY_DEV: return t('userServices.offline.name')
  }
  return authority
}

function isUserExpired(u: UserProfile) {
  return u.invalidated || u.expiredAt < Date.now()
}

function getExpiryLabel(u: UserProfile) {
  if (u.authority === AUTHORITY_DEV) return t('userServices.offline.name')
  const diff = u.expiredAt - Date.now()
  if (diff <= 0) return t('user.tokenExpired')
  const hours = Math.floor(diff / 3600000)
  const mins = Math.floor((diff % 3600000) / 60000)
  if (hours > 24) {
    const days = Math.floor(hours / 24)
    return t('user.tokenValidUntil') + ' · ' + t('relative.daysAgo', { count: days }).replace(/ ago$/, '')
  }
  if (hours > 0) return t('user.tokenValidUntil') + ' · ' + hours + 'h ' + mins + 'm'
  return t('user.tokenValidUntil') + ' · ' + mins + 'm'
}

function onSwitchUser(id: string) {
  select(id)
  userMenuOpen.value = false
}

const { refreshUser, removeUser } = useService(UserServiceKey)
const refreshingUser = ref(false)
const removingUser = ref(false)
const removeDialogShown = ref(false)
const removeTargetId = ref('')

async function onRefreshUser() {
  if (refreshingUser.value) return
  refreshingUser.value = true
  try {
    await refreshUser(userProfile.value.id)
  } finally {
    refreshingUser.value = false
  }
}

const { show: showUserProfileDialog } = useUserMenuControl()

function onIdentityClick() {
  if (!hasUsers.value) {
    openAddAccountDialog()
  }
}

function openRemoveAccountDialog() {
  removeTargetId.value = userProfile.value.id
  removeDialogShown.value = true
}

async function onRemoveUser() {
  if (!removeTargetId.value || removingUser.value) return
  removingUser.value = true
  try {
    await removeUser({ id: removeTargetId.value } as UserProfile)
    removeDialogShown.value = false
  } finally {
    removingUser.value = false
  }
}

function openAddAccountDialog() {
  userMenuOpen.value = false
  showUserProfileDialog('login')
}
</script>

<style scoped>
.user-account-switcher--comfortable .user-account-switcher__identity {
  min-height: 92px;
  gap: 16px;
  padding: 18px 20px;
  border-radius: 18px;
}

.account-switcher-menu {
  background: rgba(var(--v-theme-surface), 0.95);
  backdrop-filter: blur(20px);
}

.user-account-switcher__avatar-refresh {
  background: rgba(0, 0, 0, 0.5);
  border: 0;
  padding: 0;
  color: inherit;
  appearance: none;
}

.user-account-switcher__avatar-refresh:focus-visible {
  outline: 2px solid rgba(255, 255, 255, 0.7);
  outline-offset: 2px;
  opacity: 1;
}
</style>