<template>
  <div class="flex gap-2 items-center justify-center">
    <div
      v-for="profile of user.profiles"
      :key="profile.id"
    >
      <UserSkinView
        :user="user"
        :profile="profile"
      />
      <v-btn
        class="my-2"
        block
        text
        color="primary"
        :disabled="profile.id === user.selectedProfile"
        @click="selectGameProfile(profile.id)"
      >
        {{ profile.id === user.selectedProfile ? 'Selected' : 'Select' }}
      </v-btn>
    </div>
  </div>
</template>
<script lang="ts" setup>
import { UserProfile, UserServiceKey } from '@xmcl/runtime-api'
import UserSkinView from './UserSkinView.vue'
import { useService } from '/@/composables'

const props = defineProps<{
  user: UserProfile
}>()

const { selectGameProfile } = useService(UserServiceKey)

console.log(props.user)

</script>
