<template>
  <v-menu
    v-model="isShown"
    :close-on-content-click="false"
    transition="slide-y-transition"
  >
    <template #activator="{ props }">
      <AppSystemBarBadge
        :text="selectedUserGameProfile?.name"
        v-bind="props"
      >
        <PlayerAvatar
          class="overflow-hidden rounded-full transition-all duration-300 mr-2"
          :src="selectedUserGameProfile?.textures.SKIN.url"
          :dimension="24"
        />
      </AppSystemBarBadge>
    </template>

    <UserCard
      class="user-menu w-[600px] max-w-[600px] overflow-y-auto"
      outlined
      flat
      :show="isShown"
    />
  </v-menu>
</template>
<script lang="ts" setup>
import PlayerAvatar from '@/components/PlayerAvatar.vue'
import { kUserContext } from '@/composables/user'
import UserCard from '@/components/UserCard.vue'
import { UserSkinRenderPaused } from '@/composables/userSkin'
import { injection } from '@/util/inject'
import AppSystemBarBadge from '@/components/AppSystemBarBadge.vue'

const isShown = ref(false)
const { gameProfile: selectedUserGameProfile } = injection(kUserContext)

provide(UserSkinRenderPaused, computed(() => !isShown.value))
</script>
<style scoped>
.user-menu {
  max-height: min(700px, 90vh);
}
</style>
