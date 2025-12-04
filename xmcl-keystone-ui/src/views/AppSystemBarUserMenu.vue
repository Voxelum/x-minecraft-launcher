<template>
  <v-menu
    v-model="isShown"
    :close-on-content-click="false"
    transition="slide-y-transition"
    :nudge-width="280"
    offset-y
  >
    <template #activator="{ on, attrs }">
      <div
        id="user-avatar"
        v-bind="attrs"
        class="non-moveable flex flex-grow-0 cursor-pointer items-center gap-2 rounded px-2 transition-all hover:bg-[rgba(255,255,255,0.2)] py-1"
        :class="{ 'bg-[rgba(244,67,54,0.6)]': needLogin }"
        v-on="on"
      >
        <PlayerAvatar
          class="overflow-hidden rounded-full transition-all duration-300"
          :src="selectedUserGameProfile?.textures.SKIN.url"
          :dimension="22"
        />
        {{ needLogin ? t('login.login') : selectedUserGameProfile?.name }}
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

const { t } = useI18n()
const isShown = ref(false)
const { gameProfile: selectedUserGameProfile, users } = injection(kUserContext)
const needLogin = computed(() => users.value.length === 0 || !selectedUserGameProfile.value?.name)

provide(UserSkinRenderPaused, computed(() => !isShown.value))
</script>
<style scoped>
.user-menu {
  max-height: min(700px, 90vh);
}
</style>
