<template>
  <div
    class="flex flex-col px-4 py-2 overflow-auto w-full gap-4"
    @dragover.prevent
    @drop="onDrop"
  >
    <UserPageHeader
      :users="users"
      :selected="selectedUser"
      :refreshing="refreshing"
      :expired="isExpired"
      @login="showLoginDialog()"
      @refresh="refresh"
      @abort-refresh="onRefreshAbort()"
      @select="onSelect"
      @remove="startDelete"
    />
    <div class="h-full w-full px-4 mt-2">
      <UserMicrosoftView
        v-if="selectedUser && selectedUser.authService === 'microsoft'"
        :user="selectedUser"
      />
      <UserMojangView
        v-else-if="selectedUser && selectedUser.authService === 'mojang'"
        :user="selectedUser"
      />
      <UserYggdrasilView
        v-else-if="!!selectedUser"
        :user="selectedUser"
      />
      <div class="flex-grow" />
      <Hint
        v-if="users.length === 0"
        :text="t('login.hint')"
        class="h-full"
        icon="login"
      />
    </div>
    <DeleteDialog
      :title="t('userAccount.removeTitle') "
      :width="550"
      @confirm="confirmRemoveProfile()"
      @cancel="removingProfile = ''"
    >
      {{ t('userAccount.removeDescription') }}
      <div style="color: grey">
        {{ t('user.name') }}: {{ removingUserName }}
      </div>
      <div style="color: grey">
        {{ t('user.id') }}: {{ removingProfile }}
      </div>
    </DeleteDialog>
  </div>
</template>

<script lang=ts setup>
import { BaseServiceKey, UserProfile, UserServiceKey } from '@xmcl/runtime-api'
import DeleteDialog from '../components/DeleteDialog.vue'
import { useDialog } from '../composables/dialog'
import { LoginDialog } from '../composables/login'
import { useUsers } from '../composables/user'
import UserPageHeader from './UserHeader.vue'
import UserMicrosoftView from './UserMicrosoftView.vue'
import UserMojangView from './UserMojangView.vue'
import UserYggdrasilView from './UserYggdrasilView.vue'
import { useBusy, useOperation, useService } from '@/composables'
import { kDropService } from '@/composables/dropService'
import { injection } from '@/util/inject'
import Hint from '@/components/Hint.vue'
import { usePresence } from '@/composables/presence'

const { refreshUser: refreshAccount } = useService(UserServiceKey)
const { handleUrl } = useService(BaseServiceKey)
const { show: showLoginDialog } = useDialog(LoginDialog)
const { show: showDeleteDialog } = useDialog('deletion')
const { t } = useI18n()

const { users } = useUsers()
const { state, selectUser, removeUserProfile, abortRefresh } = useService(UserServiceKey)
const userId = computed(() => state.selectedUser.id)
const selectedUser = computed(() => users.value.find(u => u.id === userId.value))

const isExpired = computed(() => !selectedUser.value || selectedUser.value?.invalidated || selectedUser.value.expiredAt < Date.now())

const { begin: beginRemoveProfile, operate: confirmRemoveProfile, data: removingProfile } = useOperation('', (v) => removeUserProfile(v))

const removingUserName = computed(() => state.users[removingProfile.value]?.username ?? '')

const { suppressed } = injection(kDropService)

const onRefreshAbort = () => {
  abortRefresh()
}

onMounted(() => {
  suppressed.value = true
})
onUnmounted(() => {
  suppressed.value = false
})

const refreshing = useBusy('refreshUser')

function startDelete(id: string) {
  beginRemoveProfile(id)
  showDeleteDialog()
}
function refresh() {
  refreshAccount().catch(() => {
    showLoginDialog({ username: selectedUser.value?.username, service: selectedUser.value?.authService, error: t('login.userRelogin') })
  })
}
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
function onSelect(user: UserProfile) {
  selectUser(user.id)
}

usePresence({ location: 'user' })

</script>

<style>
.my-slider-x-transition-enter-active {
  transition: 0.3 cubic-bezier(0.25, 0.8, 0.5, 1);
}
.my-slider-x-transition-leave-active {
  transition: 0.3 cubic-bezier(0.25, 0.8, 0.5, 1);
}
.my-slider-x-transition-move {
  transition: transform 0.6s;
}
.my-slider-x-transition-enter {
  transform: translateX(100%);
}
.my-slider-x-transition-leave-to {
  transform: translateX(100%);
}
</style>
