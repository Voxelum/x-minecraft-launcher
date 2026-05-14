<template>
  <div
    ref="container"
    class="visible-scroll flex gap-6 overflow-auto items-center justify-center py-8 px-4"
    @wheel="onWheel"
  >
    <div
      v-for="profile of user.profiles"
      :key="profile.id"
      class="group flex flex-col items-center p-6 rounded-[2rem] transition-all duration-500 ease-out border"
      :class="profile.id === user.selectedProfile 
        ? 'bg-gradient-to-b from-primary/10 to-transparent border-primary/30 shadow-[0_20px_40px_-15px_rgba(var(--v-theme-primary),0.3)]' 
        : 'backdrop-blur-md hover:border-primary/20 hover:shadow-xl hover:-translate-y-2'"
      :style="profile.id !== user.selectedProfile ? 'background: rgba(var(--v-theme-surface), 0.5); border-color: rgba(var(--v-theme-on-surface), 0.1);' : ''"
    >
      <div class="relative mb-6">
        <div v-if="profile.id === user.selectedProfile" class="absolute inset-0 bg-primary/20 rounded-full blur-2xl transition-opacity duration-500"></div>
        <UserSkin
          class="relative z-10 transition-transform duration-500 drop-shadow-xl"
          :class="profile.id === user.selectedProfile ? 'scale-110' : 'group-hover:scale-105'"
          :user="user"
          :profile="profile"
          :inspect="false"
          @wheel.prevent.stop.native
        />
      </div>
      
      <div class="text-lg font-bold mb-4 tracking-wide truncate w-full text-center max-w-[150px]"
           :style="profile.id === user.selectedProfile ? '' : 'color: rgba(var(--v-theme-on-surface), 0.9);'">
        {{ profile.name }}
      </div>

      <div class="flex items-center justify-center gap-3">
        <v-btn
          v-if="offline"
          :disabled="Object.keys(user.profiles).length === 1"
          color="error"
          variant="tonal"
          icon
          class="hover:scale-110 active:scale-95 transition-transform"
          @click="removeGameProfile(profile.name)"
        >
          <v-icon size="20">delete</v-icon>
        </v-btn>
        
        <v-btn
          :color="profile.id === user.selectedProfile ? 'success' : 'primary'"
          :variant="profile.id === user.selectedProfile ? 'flat' : 'tonal'"
          :disabled="profile.id === user.selectedProfile"
          icon
          class="hover:scale-110 active:scale-95 transition-transform shadow-sm"
          @click="selectGameProfile(user, profile.id)"
        >
          <v-icon size="24">
            {{ profile.id === user.selectedProfile ? 'check_circle' : 'done' }}
          </v-icon>
        </v-btn>
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
