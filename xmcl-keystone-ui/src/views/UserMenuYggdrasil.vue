<template>
  <div
    ref="container"
    class="visible-scroll flex gap-2 overflow-auto"
    @wheel="onWheel"
  >
    <div
      v-for="profile of user.profiles"
      :key="profile.id"
      class="flex flex-col"
    >
      <UserSkin
        :user="user"
        :profile="profile"
        :inspect="false"
        @wheel.prevent.stop.native
      />
      <div class="my-2 flex items-center justify-center">
        <v-btn
          v-if="offline"
          text
          :disabled="Object.keys(user.profiles).length === 1"
          color="red"
          @click="removeGameProfile(profile.name)"
        >
          <v-icon>
            delete
          </v-icon>
        </v-btn>
        <v-btn
          text
          color="primary"
          :disabled="profile.id === user.selectedProfile"
          @click="selectGameProfile(user, profile.id)"
        >
          <v-icon>
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
