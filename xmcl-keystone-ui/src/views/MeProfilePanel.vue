<template>
  <div class="me-profile-panel flex flex-col h-full overflow-hidden">
    <!-- User identity: avatar + name + dropdown switcher -->
    <div class="profile-header px-3 pt-3 pb-2 flex-shrink-0">
      <v-menu
        v-model="userMenuOpen"
        :close-on-content-click="false"
        offset-y
        min-width="240"
      >
        <template #activator="{ props: menuProps }">
          <div
            v-bind="menuProps"
            class="user-identity flex items-center gap-3 cursor-pointer rounded-2xl px-3 py-2.5 border transition-all"
            style="background: rgba(var(--v-theme-on-surface), 0.04); border-color: rgba(var(--v-theme-on-surface), 0.08);"
            data-testid="me-user-switcher"
          >
            <div class="relative flex-shrink-0 group/avatar">
              <PlayerAvatar
                class="overflow-hidden rounded-full"
                :src="gameProfile?.textures?.SKIN?.url"
                :dimension="40"
              />
              <div
                class="absolute inset-0 rounded-full bg-black/50 flex items-center justify-center opacity-0 group-hover/avatar:opacity-100 transition-opacity cursor-pointer"
                @click.stop="onRefreshUser"
              >
                <v-icon size="18" color="white" :class="{ 'animate-spin': refreshingUser }">refresh</v-icon>
              </div>
            </div>
            <div class="flex flex-col flex-grow min-w-0">
              <span class="font-bold text-sm truncate">
                {{ gameProfile?.name || t('login.login') }}
              </span>
              <span class="text-xs truncate" :class="currentUserExpired ? 'text-error' : 'opacity-60'">
                {{ currentUserExpired ? t('user.tokenExpired') : authorityLabel }}
              </span>
            </div>
            <v-icon size="18" class="flex-shrink-0 opacity-60">
              {{ userMenuOpen ? 'expand_less' : 'expand_more' }}
            </v-icon>
          </div>
        </template>

        <!-- Dropdown: switch account -->
        <v-card class="rounded-xl overflow-hidden" style="background: rgba(var(--v-theme-surface), 0.95); backdrop-filter: blur(20px);">
          <v-list density="compact" class="py-1">
            <v-list-item
              v-for="u of users"
              :key="u.id"
              :class="{ 'bg-primary/10': u.id === userProfile.id }"
              class="rounded-lg mx-1 my-0.5"
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
                <v-icon v-if="u.id === userProfile.id" size="16" color="primary">check</v-icon>
              </template>
            </v-list-item>
          </v-list>
          <v-divider />
          <div class="px-2 py-2">
            <v-btn
              block
              variant="tonal"
              color="primary"
              size="small"
              class="rounded-lg"
              @click="openAddAccountDialog"
            >
              <v-icon start size="16">person_add</v-icon>
              {{ t('userAccount.add') }}
            </v-btn>
          </div>
        </v-card>
      </v-menu>
    </div>

    <!-- Skin & Cape Card -->
    <div class="skin-cape-card mx-3 mt-1 mb-2 flex-shrink-0 rounded-2xl overflow-hidden border"
      style="background: rgba(var(--v-theme-on-surface), 0.04); border-color: rgba(var(--v-theme-on-surface), 0.08);"
    >
      <!-- 3D Model with edit controls -->
      <div
        class="flex items-center justify-center py-3 cursor-default"
      >
        <UserSkin
          :user="userProfile"
          :profile="gameProfile"
          :inspect="false"
        />
      </div>

      <!-- Cape row -->
      <div v-if="capes.length > 0" class="cape-row border-t px-3 py-2.5"
        style="border-color: rgba(var(--v-theme-on-surface), 0.06);"
      >
        <div class="text-[10px] font-semibold uppercase tracking-widest opacity-50 mb-1.5">
          {{ t('userCape.changeTitle') }}
        </div>
        <div
          ref="capeScroller"
          class="cape-scroll flex gap-1.5 overflow-x-auto"
          @wheel.prevent="onCapeWheel"
        >
          <!-- No cape -->
          <div
            v-shared-tooltip.top="() => t('userCape.noCape')"
            class="cape-thumb flex-shrink-0 cursor-pointer rounded-lg border transition-all flex items-center justify-center hover:scale-110 hover:-translate-y-0.5"
            :class="!skinModel.cape.value
              ? 'border-primary bg-primary/15 shadow-sm shadow-primary/20'
              : 'border-transparent hover:border-[rgba(var(--v-theme-on-surface),0.15)] hover:bg-[rgba(var(--v-theme-on-surface),0.05)]'"
            @click="selectCape(undefined)"
          >
            <div class="w-full h-full border border-dashed border-current rounded opacity-30 flex items-center justify-center">
              <v-icon size="12">block</v-icon>
            </div>
          </div>
          <!-- Capes -->
          <div
            v-for="c of capes"
            :key="c.id"
            v-shared-tooltip.top="() => c.alias || c.id"
            class="cape-thumb flex-shrink-0 cursor-pointer rounded-lg border transition-all overflow-hidden hover:scale-110 hover:-translate-y-0.5"
            :class="skinModel.cape.value === c.url
              ? 'border-primary bg-primary/15 shadow-sm shadow-primary/20'
              : 'border-transparent hover:border-[rgba(var(--v-theme-on-surface),0.15)] hover:bg-[rgba(var(--v-theme-on-surface),0.05)]'"
            @click="selectCape(c.url)"
          >
            <div class="cape-scale-wrapper">
              <PlayerCape :src="c.url" />
            </div>
          </div>
        </div>
      </div>
    </div>
    <div class="friends-section flex-grow min-h-0 flex flex-col overflow-hidden px-3 py-3">
      <div class="flex items-center justify-between mb-2 px-1">
        <div class="text-[10px] font-semibold uppercase tracking-widest opacity-50 flex items-center gap-1.5">
          <v-icon size="13">people</v-icon>
          {{ t('minecraftFriends.friends') }}
        </div>
        <v-btn
          icon
          variant="text"
          size="x-small"
          :title="t('shared.refresh')"
          :loading="friendsLoading"
          @click="refreshFriends(true)"
        >
          <v-icon size="14">refresh</v-icon>
        </v-btn>
      </div>

      <template v-if="isMicrosoftUser">
        <!-- Settings row -->
        <div class="rounded-xl overflow-hidden mb-2 border" style="border-color: rgba(var(--v-theme-on-surface), 0.06);">
          <div
            class="flex items-center justify-between px-3 py-2 cursor-pointer transition-colors hover:bg-[rgba(var(--v-theme-on-surface),0.06)]"
            style="background: rgba(var(--v-theme-on-surface), 0.03);"
          >
            <div class="flex items-center gap-2">
              <v-icon size="14" class="opacity-50">visibility</v-icon>
              <span class="text-[11px] opacity-70">{{ t('minecraftFriends.privacy.friendsEnabled') }}</span>
            </div>
            <v-switch
              :model-value="preferences?.friendsEnabled ?? true"
              color="primary"
              density="compact"
              hide-details
              :loading="preferencesLoading"
              :disabled="preferencesLoading"
              class="flex-shrink-0"
              @update:model-value="setPreferences({ friendsEnabled: $event as boolean })"
            />
          </div>
        </div>

        <!-- Incoming requests pill -->
        <div
          v-if="incomingCount > 0"
          class="flex items-center gap-2 rounded-xl px-3 py-2 mb-2 cursor-pointer transition-all border hover:border-primary/40"
          style="background: rgba(var(--v-theme-primary), 0.08); border-color: rgba(var(--v-theme-primary), 0.15);"
          @click="showFriendsDialog"
        >
          <v-icon size="16" color="primary">mail</v-icon>
          <span class="text-xs font-medium flex-grow">
            {{ t('minecraftFriends.incomingHint', { count: incomingCount }) }}
          </span>
          <v-icon size="14" class="opacity-40">chevron_right</v-icon>
        </div>

        <!-- Friends list -->
        <div class="flex-grow overflow-y-auto min-h-0 invisible-scroll">
          <!-- Empty friends placeholder -->
          <div
            v-if="preferences?.friendsEnabled !== false && friendsData && friendsData.friends.length === 0 && incomingCount === 0 && !friendsLoading"
            class="flex flex-col items-center text-center gap-2 py-8 px-4"
          >
            <div class="w-12 h-12 rounded-2xl bg-[rgba(var(--v-theme-primary),0.1)] flex items-center justify-center">
              <v-icon size="24" color="primary" class="opacity-60">group_add</v-icon>
            </div>
            <div class="text-xs font-semibold opacity-60">{{ t('minecraftFriends.heroEmptyTitle') }}</div>
            <div class="text-[10px] opacity-35 max-w-[200px] leading-relaxed">{{ t('minecraftFriends.heroEmptyHint') }}</div>
          </div>
          <div
            v-for="f of friendsData?.friends ?? []"
            :key="f.profileId"
            class="group flex items-center gap-2.5 rounded-xl px-2.5 py-2 hover:bg-[rgba(var(--v-theme-on-surface),0.06)] transition-colors"
          >
            <v-avatar size="30" class="rounded-lg flex-shrink-0" color="grey-darken-3">
              <img
                :src="`https://mc-heads.net/avatar/${f.profileId}/30`"
                :alt="f.name"
                width="30"
                height="30"
                style="image-rendering: pixelated"
                @error="($event.target as HTMLImageElement).style.display = 'none'"
              >
            </v-avatar>
            <span class="text-[13px] font-medium truncate flex-grow">{{ f.name }}</span>
            <v-btn
              icon
              variant="text"
              size="x-small"
              color="error"
              class="opacity-0 group-hover:opacity-100 transition-opacity flex-shrink-0"
              :loading="removingFriend === f.profileId"
              @click="onRemoveFriend(f)"
            >
              <v-icon size="14">person_remove</v-icon>
            </v-btn>
          </div>
        </div>

        <!-- Add friend button -->
        <v-btn
          variant="tonal"
          color="primary"
          class="mt-2 rounded-lg flex-grow-0"
          block
          :disabled="preferences && !preferences.friendsEnabled"
          @click="showFriendsDialog"
        >
          <v-icon start size="16">person_add</v-icon>
          {{ t('minecraftFriends.add') }}
        </v-btn>
      </template>

      <div v-else class="flex flex-col items-center text-center gap-2 py-8 opacity-50">
        <v-icon size="28">lock</v-icon>
        <div class="text-xs">{{ t('minecraftFriends.requiresMicrosoft') }}</div>
      </div>
    </div>
  </div>
</template>

<script lang="ts" setup>
import PlayerAvatar from '@/components/PlayerAvatar.vue'
import PlayerCape from '@/components/PlayerCape.vue'
import UserSkin from '@/components/UserSkin.vue'
import { useService } from '@/composables'
import { useDialog } from '@/composables/dialog'
import { kMinecraftFriends } from '@/composables/minecraftFriends'
import { kUserContext } from '@/composables/user'
import { useUserMenuControl } from '@/composables/userMenu'
import { UserSkinModel, UserSkinRenderPaused, useUserSkin } from '@/composables/userSkin'
import { vSharedTooltip } from '@/directives/sharedTooltip'
import { injection } from '@/util/inject'
import { AUTHORITY_DEV, AUTHORITY_MICROSOFT, AUTHORITY_MOJANG, MinecraftFriendsServiceKey, UserServiceKey } from '@xmcl/runtime-api'
import type { MinecraftFriend, UserProfile } from '@xmcl/runtime-api'

const { t } = useI18n()

const { users, userProfile, gameProfile, select } = injection(kUserContext)
const {
  data: friendsData,
  loading: friendsLoading,
  incomingCount,
  isMicrosoftUser,
  refresh: refreshFriends,
  preferences,
  preferencesLoading,
  setPreferences,
} = injection(kMinecraftFriends)

const paused = inject(UserSkinRenderPaused, ref(false))

const skinModel = useUserSkin(
  computed(() => userProfile.value.id),
  gameProfile,
  computed(() => userProfile.value),
)
provide(UserSkinModel, skinModel)
const capes = computed(() => gameProfile.value?.capes ?? [])
const capeScroller = ref<HTMLElement | null>(null)

function selectCape(url: string | undefined) {
  skinModel.cape.value = url
  skinModel.save()
}

function onCapeWheel(e: WheelEvent) {
  if (capeScroller.value) {
    capeScroller.value.scrollLeft += e.deltaY
  }
}

const authorityLabel = computed(() => getAuthorityName(userProfile.value.authority))
const currentUserExpired = computed(() => userProfile.value.invalidated || userProfile.value.expiredAt < Date.now())

const userMenuOpen = ref(false)

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

const { refreshUser } = useService(UserServiceKey)
const refreshingUser = ref(false)

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

function openAddAccountDialog() {
  userMenuOpen.value = false
  showUserProfileDialog('login')
}

const { show: showFriendsDialog } = useDialog('minecraft-friends')

const friendsService = useService(MinecraftFriendsServiceKey)
const removingFriend = ref<string | undefined>()

async function onRemoveFriend(f: MinecraftFriend) {
  if (!userProfile.value) return
  removingFriend.value = f.profileId
  try {
    await friendsService.removeFriend(userProfile.value, f.profileId)
    await refreshFriends(true)
  } finally {
    removingFriend.value = undefined
  }
}
</script>

<style scoped>
.me-profile-panel {
  width: 280px;
  min-width: 280px;
  border-right: 1px solid rgba(var(--v-theme-on-surface), 0.08);
  background: rgba(var(--v-theme-surface), 0.6);
  backdrop-filter: blur(12px);
}

.user-identity:hover {
  background: rgba(var(--v-theme-on-surface), 0.07) !important;
  border-color: rgba(var(--v-theme-on-surface), 0.14) !important;
}

.user-identity:active {
  transform: scale(0.98);
}

.cape-thumb {
  width: 36px;
  height: 52px;
  padding: 3px;
}

.cape-scale-wrapper {
  width: 80px;
  height: 120px;
  transform: scale(0.375);
  transform-origin: top left;
}

.cape-scroll {
  scrollbar-width: none;
}

.cape-scroll::-webkit-scrollbar {
  height: 0;
  display: none;
}

.invisible-scroll {
  scrollbar-width: thin;
  scrollbar-color: rgba(var(--v-theme-on-surface), 0.1) transparent;
}

.invisible-scroll::-webkit-scrollbar {
  width: 3px;
}

.invisible-scroll::-webkit-scrollbar-thumb {
  background: rgba(var(--v-theme-on-surface), 0.1);
  border-radius: 3px;
}

.invisible-scroll::-webkit-scrollbar-track {
  background: transparent;
}
</style>
