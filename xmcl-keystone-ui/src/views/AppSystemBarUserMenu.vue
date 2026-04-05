<template>
  <div>
    <!-- The user activator button -->
    <div
      id="user-avatar"
      class="non-moveable flex flex-grow-0 cursor-pointer items-center gap-2 rounded px-2 transition-all hover:bg-[rgba(255,255,255,0.2)] py-1"
      :class="{ 'bg-[rgba(244,67,54,0.6)]': needLogin }"
      @click="isShown = true"
    >
      <PlayerAvatar
        class="overflow-hidden rounded-full transition-all duration-300"
        :src="selectedUserGameProfile?.textures?.SKIN?.url"
        :dimension="22"
      />
      {{ needLogin ? t('login.login') : selectedUserGameProfile?.name }}
    </div>

    <!-- The new Profile Dialog -->
    <UserProfileDialog :value="isShown" @input="isShown = $event" />
  </div>
</template>
<script lang="ts" setup>
import PlayerAvatar from '@/components/PlayerAvatar.vue'
import { kUserContext } from '@/composables/user'
import UserProfileDialog from '@/components/UserProfileDialog.vue'
import { UserSkinRenderPaused } from '@/composables/userSkin'
import { injection } from '@/util/inject'

const { t } = useI18n()
const isShown = ref(false)
const { gameProfile: selectedUserGameProfile, users } = injection(kUserContext)
const needLogin = computed(() => users.value.length === 0 || !selectedUserGameProfile.value?.name)

provide(UserSkinRenderPaused, computed(() => !isShown.value))
</script>
