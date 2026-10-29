<template>
  <v-menu
    v-model="shown"
    :target="target"
    :location="location"
    :offset="offset"
    :close-on-content-click="false"
    transition="fade-transition"
    z-index="300"
  >
    <v-card
      data-testid="sidebar-account-menu"
      class="sidebar-account-menu rounded-2xl border border-white/10 bg-surface/95 backdrop-blur-xl shadow-2xl overflow-hidden"
      :min-width="260"
      :max-width="320"
      elevation="8"
    >
      <div class="flex items-center justify-between px-3.5 pt-3 pb-2 border-b border-white/5">
        <div class="flex items-center gap-2">
          <v-icon size="16" color="primary">manage_accounts</v-icon>
          <span class="text-xs font-bold tracking-wider uppercase text-medium-emphasis">
            {{ t('myStuff') }}
          </span>
        </div>
        <v-btn
          icon="close"
          :aria-label="t('shared.close')"
          :title="t('shared.close')"
          variant="text"
          size="x-small"
          class="opacity-60 hover:opacity-100"
          @click="shown = false"
        />
      </div>

      <v-list
        density="compact"
        class="py-1 max-h-[340px] overflow-y-auto visible-scroll"
        bg-color="transparent"
        role="menu"
      >
        <template v-if="accountEntries.length > 0">
          <v-list-item
            v-for="entry in accountEntries"
            :key="entry.key"
            data-testid="account-item"
            class="mx-1.5 my-0.5 rounded-xl cursor-pointer transition-colors"
            :class="{
              'bg-primary/15 text-primary border border-primary/30': entry.isCurrent,
              'hover:bg-white/5': !entry.isCurrent,
            }"
            :aria-current="entry.isCurrent ? 'true' : undefined"
            @click="onSelectAccount(entry)"
          >
            <template #prepend>
              <PlayerAvatar
                class="overflow-hidden rounded-full mr-3 flex-shrink-0"
                :src="entry.profile?.textures?.SKIN?.url ?? ''"
                :dimension="32"
              />
            </template>

            <v-list-item-title class="text-sm font-semibold truncate">
              {{ entry.profile?.name || entry.user.username }}
            </v-list-item-title>

            <v-list-item-subtitle
              class="text-xs truncate"
              :class="isUserExpired(entry.user) ? 'text-error font-medium' : 'opacity-60'"
            >
              {{ isUserExpired(entry.user) ? t('user.tokenExpired') : getAuthorityName(entry.user.authority) }}
            </v-list-item-subtitle>

            <template #append>
              <v-icon v-if="entry.isCurrent" size="18" color="primary">check</v-icon>
            </template>
          </v-list-item>
        </template>
        <div v-else class="px-4 py-4 text-center text-xs text-medium-emphasis">
          {{ t('myStuff') }}
        </div>
      </v-list>

      <v-divider class="border-white/5" />

      <div class="p-2 flex flex-col gap-1 bg-white/[0.02]">
        <v-btn
          block
          data-testid="accounts-add"
          variant="tonal"
          color="primary"
          size="small"
          class="rounded-lg font-medium justify-start"
          prepend-icon="person_add"
          @click="onAddAccount"
        >
          {{ t('userAccount.add') }}
        </v-btn>
        <v-btn
          block
          variant="text"
          size="small"
          class="rounded-lg text-medium-emphasis hover:text-high-emphasis justify-start"
          prepend-icon="account_circle"
          @click="onGoToMyStuff"
        >
          {{ t('myStuff') }}
        </v-btn>
      </div>
    </v-card>
  </v-menu>
</template>

<script lang="ts" setup>
import PlayerAvatar from '@/components/PlayerAvatar.vue'
import { useService } from '@/composables'
import { kUserContext } from '@/composables/user'
import { useUserMenuControl } from '@/composables/userMenu'
import { injection } from '@/util/inject'
import {
  AUTHORITY_DEV,
  AUTHORITY_MICROSOFT,
  AUTHORITY_MOJANG,
  GameProfileAndTexture,
  UserProfile,
  UserServiceKey,
} from '@xmcl/runtime-api'
import { computed, nextTick, ref } from 'vue'
import { useRouter } from 'vue-router'

withDefaults(defineProps<{
  location?: any
  offset?: number
}>(), {
  location: 'end top',
  offset: 12,
})

const { t } = useI18n()
const router = useRouter()
const { users, userProfile, select } = injection(kUserContext)
const { selectUserGameProfile } = useService(UserServiceKey)
const { show: showUserProfileDialog } = useUserMenuControl()

const shown = ref(false)
const target = ref<HTMLElement | [number, number] | undefined>()
const isSelectingAccount = ref(false)

interface AccountEntry {
  key: string
  user: UserProfile
  profile?: GameProfileAndTexture
  isCurrent: boolean
}

const accountEntries = computed<AccountEntry[]>(() => {
  const result: AccountEntry[] = []
  for (const u of users.value) {
    const pids = Object.keys(u.profiles)
    if (!pids.length) {
      result.push({ key: u.id, user: u, profile: undefined, isCurrent: u.id === userProfile.value.id })
    } else {
      for (const pid of pids) {
        result.push({
          key: `${u.id}:${pid}`,
          user: u,
          profile: u.profiles[pid],
          isCurrent: u.id === userProfile.value.id && pid === u.selectedProfile,
        })
      }
    }
  }
  return result
})

const authorityMap: Record<string, string> = {
  [AUTHORITY_MICROSOFT]: 'userServices.microsoft.name',
  [AUTHORITY_MOJANG]: 'userServices.mojang.name',
  [AUTHORITY_DEV]: 'userServices.offline.name',
}
const getAuthorityName = (auth: string) => authorityMap[auth] ? t(authorityMap[auth]) : auth
const isUserExpired = (u: UserProfile) => u.invalidated || u.expiredAt < Date.now()

async function onSelectAccount(entry: AccountEntry) {
  if (isSelectingAccount.value) return
  if (entry.isCurrent) return void (shown.value = false)
  isSelectingAccount.value = true
  try {
    if (entry.profile && entry.user.selectedProfile !== entry.profile.id) {
      await selectUserGameProfile(entry.user, entry.profile.id)
    }
    select(entry.user.id)
    shown.value = false
  } finally {
    isSelectingAccount.value = false
  }
}

function onAddAccount() {
  shown.value = false
  showUserProfileDialog('login')
}

function onGoToMyStuff() {
  shown.value = false
  router.push('/me')
}

function open(event: MouseEvent) {
  target.value = (event.currentTarget as HTMLElement) || [event.clientX, event.clientY]
  shown.value = false
  nextTick(() => { shown.value = true })
}

defineExpose({
  open,
  close: () => { shown.value = false },
})
</script>
