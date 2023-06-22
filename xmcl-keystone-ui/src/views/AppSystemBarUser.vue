<template>
  <v-menu
    v-model="isShown"
    :close-on-content-click="false"
    :nudge-width="280"
    offset-y
    class="z-20"
  >
    <template #activator="{ on, attrs }">
      <div
        v-bind="attrs"
        class="non-moveable hover:bg-[rgba(255,255,255,0.2)] cursor-pointer px-2 rounded transition-all flex flex-grow-0 items-center gap-2"
        v-on="on"
      >
        <PlayerAvatar
          class="rounded-full overflow-hidden transition-all duration-300"
          :src="selectedUserGameProfile?.textures.SKIN.url"
          :dimension="28"
        />
        {{ selectedUserGameProfile?.name }}
      </div>
    </template>

    <UserMenu
      :users="users"
      :selected="selectedUser"
      @select="onSelectUser"
      @refresh="onRefresh"
      @remove="onRemoveUser"
      @abort-refresh="onAbortRefresh"
    />
  </v-menu>
</template>
<script lang="ts" setup>
import PlayerAvatar from '@/components/PlayerAvatar.vue'
import { useService } from '@/composables'
import { useDialog } from '@/composables/dialog'
import { LoginDialog } from '@/composables/login'
import { kUserContext } from '@/composables/user'
import { UserSkinRenderPaused } from '@/composables/userSkin'
import { injection } from '@/util/inject'
import { UserServiceKey } from '@xmcl/runtime-api'
import UserMenu from './UserMenu.vue'

const { users, userProfile: selectedUser, gameProfile: selectedUserGameProfile } = injection(kUserContext)
const { selectUser, abortRefresh, refreshUser, removeUserProfile } = useService(UserServiceKey)
const { show: showLoginDialog } = useDialog(LoginDialog)
const isShown = ref(false)

const { t } = useI18n()
const onSelectUser = (user: string) => {
  isShown.value = false
  selectUser(user)
}
watch(isShown, (show) => {
  if (show && users.value.length === 0) {
    showLoginDialog()
    nextTick().then(() => {
      isShown.value = false
    })
  }
})
function onRefresh() {
  if (users.value.length === 0) {
    showLoginDialog()
  } else {
    refreshUser().catch(() => {
      showLoginDialog({ username: selectedUser.value?.username, service: selectedUser.value?.authService, error: t('login.userRelogin') })
    })
  }
}
async function onRemoveUser() {
  const isLastOne = users.value.length <= 0
  await removeUserProfile(selectedUser.value.id)
  if (isLastOne) {
    showLoginDialog()
  }
}

provide(UserSkinRenderPaused, computed(() => !isShown.value))
function onAbortRefresh() {
  abortRefresh()
}
</script>
