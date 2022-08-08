<template>
  <div
    class="flex flex-col px-8 py-4 overflow-auto w-full gap-4"
    @dragover.prevent
    @drop="onDrop"
  >
    <user-page-header
      :users="users"
      :selected="selected"
      :refreshing="refreshing"
      @addaccount="showLoginDialog()"
      @refresh="refresh"
      @select="onSelect"
      @remove="startDelete"
    />
    <div class="h-full w-full">
      <user-microsoft-view
        v-if="selected && selected.authService === 'microsoft'"
        :user="selected"
        :profile-id="profileId"
      />
      <user-mojang-view
        v-else-if="selected && selected.authService === 'mojang'"
        :user="selected"
        :profile-id="profileId"
      />
      <user-little-skin-view
        v-else-if="selected && selected.authService === 'littleskin.cn'"
        :user="selected"
        :profile-id="profileId"
      />
      <user-offline-view
        v-else-if="selected && selected.authService === 'offline'"
        :user="selected"
        :profile-id="profileId"
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
import { useProfileId, useSwitchUser, useUsers } from '../composables/user'
import UserPageHeader from './UserHeader.vue'
import UserLittleSkinView from './UserLittleSkinView.vue'
import UserMicrosoftView from './UserMicrosoftView.vue'
import UserMojangView from './UserMojangView.vue'
import { useBusy, useI18n, useOperation, useService, useServiceBusy } from '/@/composables'
import UserOfflineView from './UserOfflineView.vue'

const { refreshUser: refreshAccount, refreshSkin } = useService(UserServiceKey)
const { handleUrl } = useService(BaseServiceKey)
const { show: showLoginDialog } = useDialog('login')
const { t } = useI18n()

const { users } = useUsers()
const { select, remove, modified, commit, userId, profileId } = useSwitchUser()
const { show } = useDialog('deletion')
const data = reactive({
  deleting: false,
  dragged: false,
})

const { begin: beginRemoveProfile, operate: confirmRemoveProfile, data: removingProfile } = useOperation('', (v) => remove(v))

const { state } = useService(UserServiceKey)
const removingUserName = computed(() => state.users[removingProfile.value]?.username ?? '')
const selected = computed(() => {
  return users.value.find(u => u.id === userId.value)
})

const refreshingSkin = useServiceBusy(UserServiceKey, 'refreshSkin', computed(() => `${userId.value}[${profileId.value}]`))
const refreshingAccount = useServiceBusy(UserServiceKey, 'refreshUser')
const refreshing = computed(() => refreshingSkin.value || refreshingAccount.value)
function startDelete(id: string) {
  beginRemoveProfile(id)
  show()
}
function refresh() {
  refreshAccount()
  refreshSkin()
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
  select(user.selectedProfile, user.id)
  commit()
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
