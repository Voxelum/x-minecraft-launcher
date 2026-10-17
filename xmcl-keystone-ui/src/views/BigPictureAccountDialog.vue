<template>
  <v-dialog
    v-model="model"
    max-width="580"
    content-class="elevation-0"
    transition="dialog-transition"
  >
    <div class="bp-subpage-card !m-0 !p-8 flex flex-col gap-6 max-h-[85vh] overflow-y-auto custom-scrollbar">
      <!-- Header -->
      <div class="flex items-center justify-between pb-4 border-b border-white/10">
        <div class="flex items-center gap-3">
          <div class="w-12 h-12 rounded-2xl bg-primary/20 flex items-center justify-center">
            <v-icon size="28" color="primary">manage_accounts</v-icon>
          </div>
          <div>
            <h2 class="text-2xl font-black text-white tracking-wide">
              {{ t('bigPicture.accountSwitcherTitle') }}
            </h2>
            <p class="text-xs text-white/50">
              {{ t('bigPicture.accountSwitcherHint') }}
            </p>
          </div>
        </div>

        <button
          type="button"
          class="w-10 h-10 rounded-xl bg-white/5 hover:bg-white/15 flex items-center justify-center transition-colors text-white/70"
          data-gamepad-focusable
          @click="model = false"
        >
          <span v-if="gamepadConnected" class="bp-glyph bp-glyph--b !mr-0">{{ buttonBLabel }}</span>
          <v-icon v-else size="20">close</v-icon>
        </button>
      </div>

      <!-- Account List -->
      <div class="flex flex-col gap-3">
        <div
          v-for="entry in accountEntries"
          :key="entry.key"
          class="flex items-center justify-between p-4 rounded-2xl border-2 transition-all cursor-pointer"
          :class="entry.isCurrent ? 'bg-primary/20 border-primary shadow-lg shadow-primary/10' : 'bg-white/5 border-transparent hover:bg-white/10 hover:border-white/20'"
          role="button"
          tabindex="0"
          data-gamepad-focusable
          @click="onSwitchAccount(entry)"
          @keydown.enter.prevent="onSwitchAccount(entry)"
          @keydown.space.prevent="onSwitchAccount(entry)"
        >
          <div class="flex items-center gap-4 min-w-0">
            <PlayerAvatar
              class="overflow-hidden rounded-full ring-2 flex-shrink-0"
              :class="entry.isCurrent ? 'ring-primary' : 'ring-white/20'"
              :src="entry.profile?.textures?.SKIN?.url || ''"
              :dimension="48"
            />
            <div class="flex flex-col min-w-0">
              <div class="flex items-center gap-2">
                <span class="font-bold text-base text-white truncate">
                  {{ entry.profile?.name || entry.user.username }}
                </span>
                <v-chip
                  v-if="entry.isCurrent"
                  size="x-small"
                  color="primary"
                  label
                  class="font-bold uppercase tracking-wider"
                >
                  {{ t('bigPicture.currentAccount') }}
                </v-chip>
              </div>
              <div class="flex items-center gap-2 text-xs text-white/60">
                <span>{{ getAuthorityLabel(entry.user.authority) }}</span>
                <span v-if="isUserExpired(entry.user)" class="text-error font-semibold">
                  · {{ t('bigPicture.tokenExpired') }}
                </span>
              </div>
            </div>
          </div>

          <div class="flex items-center gap-2">
            <button
              v-if="!entry.isCurrent"
              type="button"
              class="w-9 h-9 rounded-xl bg-red-500/10 hover:bg-red-500/25 text-red-400 flex items-center justify-center transition-colors"
              title="Remove Account"
              data-gamepad-focusable
              @click.stop="onRemoveAccount(entry)"
            >
              <v-icon size="18">delete</v-icon>
            </button>
            <div
              v-if="entry.isCurrent"
              class="w-8 h-8 rounded-full bg-primary flex items-center justify-center text-black"
            >
              <v-icon size="18" color="black">check</v-icon>
            </div>
          </div>
        </div>
      </div>

      <!-- Add Account Button -->
      <button
        type="button"
        class="bp-play-btn !py-4 font-bold flex items-center justify-center gap-3 w-full"
        data-gamepad-focusable
        @click="onAddAccount"
      >
        <span v-if="gamepadConnected" class="bp-glyph bp-glyph--a">{{ buttonALabel }}</span>
        <v-icon size="22">person_add</v-icon>
        <span>{{ t('bigPicture.addAccount') }}</span>
      </button>
    </div>
  </v-dialog>
</template>

<script setup lang="ts">
import { computed } from 'vue'
import { useI18n } from 'vue-i18n'
import PlayerAvatar from '@/components/PlayerAvatar.vue'
import { useGamepad } from '@/composables/gamepad'
import { useService } from '@/composables'
import { injection } from '@/util/inject'
import { kUserContext } from '@/composables/user'
import { useUserMenuControl } from '@/composables/userMenu'
import {
  AUTHORITY_DEV,
  AUTHORITY_MICROSOFT,
  AUTHORITY_MOJANG,
  UserServiceKey,
  type GameProfileAndTexture,
  type UserProfile,
} from '@xmcl/runtime-api'

const props = defineProps<{
  modelValue: boolean
}>()

const emit = defineEmits<{
  (e: 'update:modelValue', value: boolean): void
}>()

const model = computed({
  get: () => props.modelValue,
  set: (v) => emit('update:modelValue', v),
})

const { t } = useI18n()
const gamepad = useGamepad()
const gamepadConnected = gamepad.connected
const buttonALabel = gamepad.buttonA
const buttonBLabel = gamepad.buttonB

const { users, userProfile, select } = injection(kUserContext)
const { removeUser, selectUserGameProfile } = useService(UserServiceKey)
const { show: showUserMenu } = useUserMenuControl()

interface AccountEntry {
  key: string
  user: UserProfile
  profile: GameProfileAndTexture | undefined
  isCurrent: boolean
}

const accountEntries = computed<AccountEntry[]>(() => {
  const entries: AccountEntry[] = []
  for (const u of users.value) {
    const profileIds = Object.keys(u.profiles)
    if (profileIds.length === 0) {
      entries.push({
        key: u.id,
        user: u,
        profile: undefined,
        isCurrent: u.id === userProfile.value.id,
      })
      continue
    }
    for (const pid of profileIds) {
      entries.push({
        key: `${u.id}:${pid}`,
        user: u,
        profile: u.profiles[pid],
        isCurrent: u.id === userProfile.value.id && pid === u.selectedProfile,
      })
    }
  }
  return entries
})

function getAuthorityLabel(authority: string) {
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

async function onSwitchAccount(entry: AccountEntry) {
  if (entry.profile && entry.user.selectedProfile !== entry.profile.id) {
    await selectUserGameProfile(entry.user, entry.profile.id)
  }
  select(entry.user.id)
  model.value = false
}

async function onRemoveAccount(entry: AccountEntry) {
  await removeUser(entry.user)
}

function onAddAccount() {
  model.value = false
  showUserMenu('login')
}
</script>
