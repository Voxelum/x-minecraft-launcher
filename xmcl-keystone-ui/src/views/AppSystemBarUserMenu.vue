<template>
  <v-menu
    v-model="isShown"
    :close-on-content-click="false"
    transition="slide-y-transition"
    :nudge-width="280"
    offset-y
    class="z-20"
  >
    <template #activator="{ on, attrs }">
      <div
        id="user-avatar"
        v-bind="attrs"
        class="non-moveable flex flex-grow-0 cursor-pointer items-center gap-2 rounded px-2 transition-all hover:bg-[rgba(255,255,255,0.2)]"
        v-on="on"
      >
        <PlayerAvatar
          class="overflow-hidden rounded-full transition-all duration-300"
          :src="selectedUserGameProfile?.textures.SKIN.url"
          :dimension="28"
        />
        {{ selectedUserGameProfile?.name }}
      </div>
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

const isShown = ref(false)
const { gameProfile: selectedUserGameProfile } = injection(kUserContext)

provide(UserSkinRenderPaused, computed(() => !isShown.value))
</script>
<style scoped>
.user-menu {
  max-height: min(700px, 90vh);
}
</style>
