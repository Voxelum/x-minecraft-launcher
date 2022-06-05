<template>
  <div
    class="flex flex-col p-4 overflow-auto w-full"
    @dragover.prevent
    @drop="onDrop"
  >
    <div class="grid grid-cols-5 h-full overflow-auto w-full">
      <div
        class="col-span-4 flex flex-col h-full overflow-auto relative flex-grow"
      >
        <user-page-header
          @addaccount="showLoginDialog()"
          @refresh="refresh"
        />
        <div
          v-if="!security"
          d-flex
          xs1
        >
          <v-alert
            :value="!security"
            style="cursor: pointer;"
            @click="data.isChallengesDialogShown = true"
          >
            {{ t('user.insecureClient') }}
          </v-alert>
        </div>
        <div
          class="overflow-auto"
        >
          <user-list
            :user-id="userId"
            :profile-id="profileId"
            :users="users"
            :select="select"
            @delete="startDelete($event.id)"
            @dragstart="data.dragged=true"
            @dragend="data.dragged=false"
          />
        </div>
        <div class="flex-grow" />
        <game-profile-speed-dial
          :visibled="modified || data.dragged"
          :deleting="data.dragged"
          :loading="loading"
          @click="confirmSelectGameProfile"
          @dragover.prevent="() => {}"
          @drop="startDelete($event.dataTransfer.getData('id'))"
        />
      </div>
      <page-skin-view
        class="col-span-1 flex h-full overflow-auto relative justify-center items-center z-5"
        :user-id="userId"
        :profile-id="profileId"
        :name="name"
      />
    </div>
    <v-dialog
      v-model="data.isChallengesDialogShown"
      width="500"
    >
      <challenges-form :show="data.isChallengesDialogShown" />
    </v-dialog>
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
import { useI18n, useOperation, useService } from '/@/composables'
import { BaseServiceKey, UserServiceKey } from '@xmcl/runtime-api'
import ChallengesForm from './UserChallengesForm.vue'
import PageSkinView from './UserSkinView.vue'
import GameProfileSpeedDial from './UserSpeedDial.vue'
import UserList from './UserList.vue'
import UserPageHeader from './UserHeader.vue'
import { useDialog } from '../composables/dialog'
import { useCurrentUser, useUserSecurityStatus, useUsers, useSwitchUser, useProfileId, useGameProfile } from '../composables/user'
import DeleteDialog from '../components/DeleteDialog.vue'

const { refreshStatus: refreshAccount, refreshSkin } = useCurrentUser()
const { security } = useUserSecurityStatus()
const { handleUrl } = useService(BaseServiceKey)
const { show: showLoginDialog } = useDialog('login')
const { t } = useI18n()

const { users } = useUsers()
const { select, remove, modified, commit, userId, profileId } = useSwitchUser()
const { gameProfile } = useProfileId(userId, profileId)
const { name } = useGameProfile(gameProfile)
const { show } = useDialog('deletion')
const data = reactive({
  isChallengesDialogShown: false,

  selecting: false,
  deleting: false,
  dragged: false,
})
const loading = computed(() => data.selecting || data.deleting)
const { begin: beginRemoveProfile, operate: confirmRemoveProfile, data: removingProfile, cancel: cancelRemoveProfile } = useOperation('', (v) => remove(v))

const { state } = useService(UserServiceKey)
const removingUserName = computed(() => state.users[removingProfile.value]?.username ?? '')

function confirmSelectGameProfile() {
  data.selecting = true
  commit().finally(() => { data.selecting = false })
}

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
