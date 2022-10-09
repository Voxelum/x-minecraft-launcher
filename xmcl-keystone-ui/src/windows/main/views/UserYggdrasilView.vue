<template>
  <div class="flex gap-2 justify-center flex-wrap max-w-full">
    <div
      v-for="profile of user.profiles"
      :key="profile.id"
    >
      <UserSkinView
        :user="user"
        :profile="profile"
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
          @click="selectGameProfile(profile.id)"
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
import { OfflineUserServiceKey, UserProfile, UserServiceKey } from '@xmcl/runtime-api'
import UserSkinView from './UserSkinView.vue'
import { useService } from '/@/composables'

const props = defineProps<{
  user: UserProfile
}>()

const { removeGameProfile } = useService(OfflineUserServiceKey)
const offline = computed(() => props.user.authService === 'offline')
const { selectGameProfile } = useService(UserServiceKey)

</script>
