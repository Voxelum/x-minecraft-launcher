<template>
  <div
    ref="container"
    class="flex gap-2 overflow-auto visible-scroll"
    @wheel="onWheel"
  >
    <div
      v-for="profile of user.profiles"
      :key="profile.id"
      class="flex flex-col"
    >
      <UserSkinView
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
import { useScrollRight, useService } from '@/composables'

const props = defineProps<{
  user: UserProfile
}>()

const { removeGameProfile } = useService(OfflineUserServiceKey)
const offline = computed(() => props.user.authService === 'offline')
const { selectGameProfile } = useService(UserServiceKey)
const container = ref(null)
const { onWheel } = useScrollRight(container)

</script>
