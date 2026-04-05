<template>
  <v-dialog
    v-model="isShown"
    :width="login || addService ? 500 : 1150"
    :persistent="login || addService"
    transition="fade-transition"
    content-class="elevation-0"
  >
    <!-- Main Macos Window Container -->
    <div
      class="overflow-hidden flex flex-row w-full bg-white/80 dark:bg-[#121212]/80 backdrop-blur-3xl rounded-3xl border border-white/40 dark:border-white/10 shadow-2xl transition-all duration-300"
      :class="{ 'h-[600px]': login || addService, 'h-[750px]': !login && !addService }"
    >
      <!-- Full-screen overlay for Login / Add Service -->
      <transition name="fade-transition" mode="out-in">
        <template v-if="addService">
          <div :key="2" class="flex-grow p-4 relative w-full h-full flex flex-col">
            <UserCardAddYggdrasilService
              class="w-full flex-grow"
              @back="onBackFromAddService"
            />
          </div>
        </template>
        <template v-else-if="login">
          <div :key="1" class="flex-grow flex flex-col w-full h-full">
            <div class="w-full flex justify-between pt-6 px-6 relative z-50">
              <v-btn
                v-if="users.length > 0"
                icon
                class="bg-black/5 hover:bg-black/10 dark:bg-white/5 dark:hover:bg-white/10 transition-colors shadow-none"
                @click="login = false"
              >
                <v-icon>arrow_back</v-icon>
              </v-btn>
              <div v-else></div>
              
              <v-btn
                icon
                class="bg-black/5 hover:bg-red-500 hover:text-white dark:bg-white/5 transition-colors shadow-none"
                @click="isShown = false"
              >
                <v-icon>close</v-icon>
              </v-btn>
            </div>
            <div class="flex-grow flex flex-col justify-center items-center px-6 pb-6 mt-[-30px]">
              <UserLoginForm
                :inside="false"
                :options="options"
                class="w-full max-w-md"
                @login="reset()"
                @add-service="onAddService"
              />
            </div>
          </div>
        </template>
        
        <template v-else>
          <!-- Split Layout -->
          <div :key="0" class="flex flex-row w-full h-full">
            <!-- Left Sidebar: Account List -->
            <div class="w-[280px] flex-shrink-0 flex flex-col bg-black/5 dark:bg-white/5 border-r border-black/10 dark:border-white/10">
              <div v-if="te('userAccount.accounts')" class="px-5 py-5 text-sm font-bold text-gray-500/80 dark:text-gray-400/80 uppercase tracking-widest flex justify-between items-center">
                {{ t('userAccount.accounts') }}
              </div>
              <div v-else class="pt-4"></div>
              <div class="flex-grow overflow-y-auto px-3 invisible-scroll flex flex-col gap-2 pb-4">
                <div
                  v-for="item of usersToSwitchAndCurrent"
                  :key="item.id"
                  class="flex items-center gap-3 p-3 rounded-xl cursor-pointer transition-all duration-200"
                  :class="item.id === selected?.id ? 'bg-primary/10 dark:bg-primary/20 shadow-sm border border-primary/20' : 'hover:bg-black/5 dark:hover:bg-white/5 border border-transparent'"
                  @click="onSelectUser(item.id)"
                >
                  <img
                    v-if="item.avatar"
                    :src="item.avatar"
                    class="w-[44px] h-[44px] object-cover rounded-full flex-shrink-0"
                  />
                  <PlayerAvatar
                    v-else
                    class="overflow-hidden rounded-full flex-shrink-0"
                    :src="item.profiles[item.selectedProfile]?.textures?.SKIN?.url"
                    :dimension="44"
                  />
                  <div class="flex flex-col flex-grow overflow-hidden">
                    <span class="font-semibold text-sm truncate" :class="item.id === selected?.id ? 'text-primary dark:text-primary-light' : ''">
                      {{ maskUserName(item.username) }}
                    </span>
                    <div class="flex items-center gap-1 text-xs opacity-70">
                      <v-icon x-small color="blue">verified</v-icon>
                      <span class="truncate">{{ getAuthorityName(item.authority) }}</span>
                    </div>
                  </div>
                  <div v-if="item.id === selected?.id" class="flex-shrink-0 w-2 h-2 rounded-full bg-primary"></div>
                </div>
              </div>

              <!-- Add Account Button -->
              <div class="p-4 border-t border-black/10 dark:border-white/10">
                <button
                  class="w-full flex items-center justify-center gap-2 py-2.5 px-4 bg-primary text-white rounded-xl hover:bg-primary-dark transition-all font-medium shadow-md shadow-primary/30 active:scale-95 duration-100"
                  @click="login = true"
                >
                  <v-icon size="20">person_add</v-icon>
                  {{ t('userAccount.add') }}
                </button>
              </div>
            </div>

            <!-- Right Panel: Account Details -->
            <div class="flex-grow flex flex-col relative bg-transparent overflow-hidden">
              <!-- Top Header Actions -->
              <div class="absolute top-4 right-5 z-20 flex gap-2">
                <v-btn
                  icon
                  class="bg-black/5 dark:bg-white/5 backdrop-blur-md hover:bg-black/10 dark:hover:bg-white/10 transition-all shadow-sm"
                  :loading="refreshing"
                  @click="onRefresh(true)"
                >
                  <v-icon size="20">refresh</v-icon>
                </v-btn>
                <v-btn
                  icon
                  color="error"
                  class="bg-red-500/10 hover:bg-red-500 hover:text-white transition-all shadow-sm"
                  @click="deleteDialog.show(true)"
                >
                  <v-icon size="20">delete</v-icon>
                </v-btn>
              </div>

              <div class="flex-grow overflow-y-auto invisible-scroll p-8 pb-12">
                <UserCardMicrosoft
                  v-if="selected && selected.authority === AUTHORITY_MICROSOFT"
                  :user="selected"
                />
                <UserCardYggdrasil
                  v-else-if="!!selected"
                  :user="selected"
                />
                
                <div v-if="!selected" class="w-full h-full flex flex-col items-center justify-center opacity-50">
                  <v-icon size="64" class="mb-4">person_off</v-icon>
                  <span class="text-lg font-medium">{{ t('userAccount.noAccount') }}</span>
                </div>
              </div>
            </div>
          </div>
        </template>
      </transition>
    </div>

    <!-- Dialogs from original UserCard -->
    <SimpleDialog
      v-model="deleteDialogModel"
      :width="400"
      :title="t('userAccount.removeTitle')"
      @confirm="deleteDialog.confirm"
    >
      {{ t('userAccount.removeDescription') }}
    </SimpleDialog>
  </v-dialog>
</template>

<script lang="ts" setup>
import PlayerAvatar from '@/components/PlayerAvatar.vue'
import SimpleDialog from '@/components/SimpleDialog.vue'
import { useService } from '@/composables'
import { useLocalStorageCacheBool } from '@/composables/cache'
import { useSimpleDialog } from '@/composables/dialog'
import { kUserContext, useUserExpired } from '@/composables/user'
import { injection } from '@/util/inject'
import { AUTHORITY_MICROSOFT, AUTHORITY_MOJANG, AUTHORITY_DEV, UserServiceKey } from '@xmcl/runtime-api'
import UserCardAddYggdrasilService from './UserCardAddYggdrasilService.vue'
import UserCardMicrosoft from './UserCardMicrosoft.vue'
import UserCardYggdrasil from './UserCardYggdrasil.vue'
import UserLoginForm from './UserLoginForm.vue'

const props = defineProps<{ value: boolean }>()
const emit = defineEmits(['input'])

const isShown = computed({
  get: () => props.value,
  set: (val) => emit('input', val)
})

const { t, te } = useI18n()
const { users, select, userProfile: selected } = injection(kUserContext)
const { abortRefresh, refreshUser, removeUser } = useService(UserServiceKey)
const expired = useUserExpired(computed(() => selected.value))

const deleteDialog = useSimpleDialog<boolean>(async () => {
  if (!selected.value) return
  const isLastOne = users.value.length <= 1
  await removeUser(selected.value)
  if (isLastOne) {
    login.value = true
  } else {
    select(users.value[0].id)
  }
})
const deleteDialogModel = deleteDialog.model
const streamerMode = inject('streamerMode', useLocalStorageCacheBool('streamerMode', false))

const onSelectUser = (user: string) => {
  select(user)
}
const login = ref(users.value.length === 0)
const addService = ref(false)
const refreshing = ref(false)

const usersToSwitchAndCurrent = computed(() => {
  // Return all users
  return users.value
})

const getAuthorityName = (authority: string) => {
  switch (authority) {
    case AUTHORITY_MICROSOFT: return t('userServices.microsoft.name')
    case AUTHORITY_MOJANG: return t('userServices.mojang.name')
    case AUTHORITY_DEV: return t('userServices.offline.name')
  }
  return authority
}

const maskUserName = (input: string) => {
  if (!streamerMode.value || !input) return input
  // Check if it's a phone number (all digits, optionally with + prefix)
  const isPhoneNumber = /^\+?\d+$/.test(input)
  if (isPhoneNumber) {
    if (input.length <= 4) return input
    return input.slice(0, 3) + '***' + input.slice(-2)
  }

  // Mask email
  const atIndex = input.indexOf('@')
  if (atIndex === -1) return input
  const prefix = input.slice(0, atIndex)
  const suffix = input.slice(atIndex)
  return prefix.slice(0, 2) + '***' + suffix
}

async function onRefresh(force = false) {
  refreshing.value = true
  try {
    if (users.value.length === 0) {
      login.value = true
      return
    }
    if (!selected.value?.id) {
      select(users.value[0].id)
    }
    if (selected.value?.id || selected.value?.invalidated || expired.value) {
      // Try to refresh
      const authority = selected.value?.authority
      await refreshUser(selected.value.id, {
        silent: false,
        force,
      }).catch((e) => {
        console.error(e)
        reset({ username: selected.value?.username, authority, error: t('login.userRelogin') })
        login.value = true
      })
    }
  } finally {
    refreshing.value = false
  }
}

const options = ref(undefined as any)
const reset = (o?: { username?: string; password?: string; microsoftUrl?: string; authority?: string; error?: string }) => {
  options.value = o
  login.value = false
  addService.value = false
}

const onAddService = () => {
  addService.value = true
  login.value = false
}

const onBackFromAddService = () => {
  addService.value = false
  login.value = true
}

watch(isShown, (v) => {
  if (!v) return
  if (users.value.length === 0) {
    login.value = true
  }
  addService.value = false
})

</script>

<style scoped>
/* Vuetify dialog override */
:deep(.v-dialog) {
  box-shadow: none !important;
  border-radius: 24px;
}
</style>
