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
      :refreshing="false"
      :expired="false"
      @select="onSelectUser"
      @refresh="onRefresh"
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
import { BaseServiceKey, UserServiceKey } from '@xmcl/runtime-api'
import UserMenu from './UserMenu.vue'

const { users, userProfile: selectedUser, gameProfile: selectedUserGameProfile } = injection(kUserContext)
const { selectUser, removeUserProfile, abortRefresh, refreshUser } = useService(UserServiceKey)
const { show: showLoginDialog } = useDialog(LoginDialog)
const isShown = ref(false)

const { t } = useI18n()
const onSelectUser = (user: string) => {
  isShown.value = false
  selectUser(user)
}
function onRefresh() {
  refreshUser().catch(() => {
    showLoginDialog({ username: selectedUser.value?.username, service: selectedUser.value?.authService, error: t('login.userRelogin') })
  })
}

provide(UserSkinRenderPaused, computed(() => !isShown.value))
function onAbortRefresh() {
  abortRefresh()
}

const { handleUrl } = useService(BaseServiceKey)
function onDrop(e: DragEvent) {
  const dataTransfer = e.dataTransfer!
  if (dataTransfer.items.length > 0) {
    for (let i = 0; i < dataTransfer.items.length; ++i) {
      const item = dataTransfer.items[i]
      if (item.kind === 'string') {
        item.getAsString((content) => {
          if (content.startsWith('authlib-injector:yggdrasil-server:')) {
            handleUrl(content)
          }
        })
        break
      }
    }
  }
}
</script>
