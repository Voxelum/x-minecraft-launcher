<template>
  <div
    class="flex flex-col px-8 py-4 overflow-auto w-full gap-4"
    @dragover.prevent
    @drop="onDrop"
  >
    <user-page-header
      :users="users"
      :selected="selectedUser"
      :refreshing="refreshing"
      :expired="isExpired"
      @addaccount="showLoginDialog()"
      @refresh="refresh"
      @select="onSelect"
      @remove="startDelete"
    />
    <div class="h-full w-full">
      <user-microsoft-view
        v-if="selectedUser && selectedUser.authService === 'microsoft'"
        :user="selectedUser"
      />
      <user-mojang-view
        v-else-if="selectedUser && selectedUser.authService === 'mojang'"
        :user="selectedUser"
      />
      <user-offline-view
        v-else-if="selectedUser && selectedUser.authService === 'offline'"
        :user="selectedUser"
      />
      <user-yggdrasil-view
        v-else
        :user="selectedUser"
      />
      <div class="flex-grow" />
    </div>
    <delete-dialog
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
    </delete-dialog>
  </div>
</template>

<script lang=ts setup>
import { BaseServiceKey, UserProfile, UserServiceKey } from '@xmcl/runtime-api'
import DeleteDialog from '../components/DeleteDialog.vue'
import { useDialog } from '../composables/dialog'
import { LoginDialog } from '../composables/login'
import { useUsers } from '../composables/user'
import UserPageHeader from './UserHeader.vue'
import UserYggdrasilView from './UserYggdrasilView.vue'
import UserMicrosoftView from './UserMicrosoftView.vue'
import UserMojangView from './UserMojangView.vue'
import UserOfflineView from './UserOfflineView.vue'
import { useI18n, useOperation, useService, useServiceBusy } from '/@/composables'
import { DropServiceInjectionKey } from '/@/composables/dropService'
import { injection } from '/@/util/inject'

const { refreshUser: refreshAccount, refreshSkin } = useService(UserServiceKey)
const { handleUrl } = useService(BaseServiceKey)
const { show: showLoginDialog } = useDialog(LoginDialog)
const { show } = useDialog('deletion')
const { t } = useI18n()

const { users } = useUsers()
const { state, selectUser, removeUserProfile } = useService(UserServiceKey)
const userId = computed(() => state.selectedUser.id)
const selectedUser = computed(() => users.value.find(u => u.id === userId.value))

const isExpired = computed(() => !selectedUser.value?.accessToken || selectedUser.value.expiredAt < Date.now())

console.log(selectedUser)

const { begin: beginRemoveProfile, operate: confirmRemoveProfile, data: removingProfile } = useOperation('', (v) => removeUserProfile(v))

const removingUserName = computed(() => state.users[removingProfile.value]?.username ?? '')

const { suppressed } = injection(DropServiceInjectionKey)

onMounted(() => {
  suppressed.value = true
})
onUnmounted(() => {
  suppressed.value = false
})

const refreshingSkin = useServiceBusy(UserServiceKey, 'refreshSkin', computed(() => `${userId.value}`))
const refreshingAccount = useServiceBusy(UserServiceKey, 'refreshUser')
const refreshing = computed(() => refreshingSkin.value || refreshingAccount.value)
function startDelete(id: string) {
  beginRemoveProfile(id)
  show()
}
function refresh() {
  if (!isExpired.value) {
    refreshAccount()
    refreshSkin()
  } else {
    showLoginDialog({ username: selectedUser.value?.username, service: selectedUser.value?.authService, error: t('login.userRelogin') })
  }
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
