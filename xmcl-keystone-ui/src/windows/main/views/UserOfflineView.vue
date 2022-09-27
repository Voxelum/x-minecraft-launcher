<template>
  <div class="flex gap-4 items-center justify-center">
    <div class="w-60">
      <UserSkinView
        class="flex overflow-auto relative justify-center items-center z-5"
        :user="user"
        :profile="gameProfile"
      />
    </div>
  </div>
</template>
<script lang="ts" setup>
import { UserProfile } from '@xmcl/runtime-api'
import UserSkinView from './UserSkinView.vue'

const props = defineProps<{
  user: UserProfile
}>()
const gameProfile = computed(() => props.user.profiles[props.user.selectedProfile])
</script>
