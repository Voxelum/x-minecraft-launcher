<template>
  <div class="h-full flex flex-col w-full">
    <div class="flex items-center gap-2 mb-6">
      <v-icon size="20">people</v-icon>
      <span class="text-lg font-semibold">{{ te('user.profiles') ? t('user.profiles') : 'Profiles' }}</span>
    </div>

    <div
      ref="container"
      class="flex-grow flex flex-wrap gap-6 overflow-y-auto invisible-scroll pb-6"
    >
      <div
        v-for="profile of user.profiles"
        :key="profile.id"
        class="flex flex-col items-center bg-black/5 dark:bg-white/5 rounded-3xl p-4 border transition-all duration-300 w-[240px]"
        :class="profile.id === user.selectedProfile ? 'border-primary shadow-lg shadow-primary/20' : 'border-black/10 dark:border-white/10 hover:shadow-md'"
      >
        <div class="w-full h-[280px] bg-black/10 dark:bg-white/10 rounded-2xl mb-4 overflow-hidden relative flex items-center justify-center">
          <UserSkin
            :user="user"
            :profile="profile"
            :inspect="false"
            class="w-full h-full"
            @wheel.prevent.stop.native
          />
        </div>
        
        <div class="text-sm font-bold text-gray-800 dark:text-gray-200 mb-4 text-center w-full truncate px-2">
          {{ profile.name }}
        </div>

        <div class="flex items-center justify-center gap-2 w-full">
          <v-btn
            v-if="offline"
            icon
            :disabled="Object.keys(user.profiles).length === 1"
            class="bg-red-500/10 hover:bg-red-500 hover:text-white transition-colors"
            color="error"
            small
            @click="removeGameProfile(profile.name)"
          >
            <v-icon size="18">delete</v-icon>
          </v-btn>
          <v-btn
            v-if="profile.id !== user.selectedProfile"
            depressed
            color="primary"
            class="rounded-xl flex-grow px-4"
            small
            @click="selectGameProfile(user, profile.id)"
          >
            {{ te('userAccount.select') ? t('userAccount.select') : 'Select' }}
          </v-btn>
          <div v-else class="flex-grow flex items-center justify-center gap-1 text-primary text-sm font-semibold">
            <v-icon size="16" color="primary">check_circle</v-icon>
            {{ te('userAccount.selected') ? t('userAccount.selected') : 'Selected' }}
          </div>
        </div>
      </div>
    </div>
  </div>
</template>
<script lang="ts" setup>
import { useScrollRight, useService } from '@/composables'
import { AUTHORITY_DEV, UserProfile, UserServiceKey } from '@xmcl/runtime-api'
import UserSkin from './UserSkin.vue'

const props = defineProps<{
  user: UserProfile
}>()

const { t, te } = useI18n()
const { selectUserGameProfile, removeUserGameProfile } = useService(UserServiceKey)
const offline = computed(() => props.user.authority === AUTHORITY_DEV)
const selectGameProfile = (userProfile: UserProfile, id: string) => {
  selectUserGameProfile(userProfile, id)
}

async function removeGameProfile(name: string): Promise<void> {
  const builtin = props.user
  if (builtin && builtin.authority === AUTHORITY_DEV) {
    const profile = Object.values(builtin.profiles).find(v => v.name === name || v.id === name)
    if (profile) {
      removeUserGameProfile(builtin, profile.id)
    }
  }
}

const container = ref(null)
const { onWheel } = useScrollRight(container)

</script>
