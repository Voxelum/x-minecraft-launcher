<template>
  <div
    class="flex flex-col p-4 overflow-auto w-full"
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
            @click="isChallengesDialogShown = true"
          >
            {{ $t('user.insecureClient') }}
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
            @dragstart="dragged=true"
            @dragend="dragged=false"
          />
        </div>
        <div class="flex-grow" />
        <game-profile-speed-dial
          :visibled="userModified || dragged"
          :deleting="dragged"
          :loading="loading"
          @click="confirmSelectGameProfile"
          @dragover.prevent
          @drop="beginRemoveProfile($event.dataTransfer.getData('id'))"
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
      v-model="isChallengesDialogShown"
      width="500"
    >
      <challenges-form :show="isChallengesDialogShown" />
    </v-dialog>
    <v-dialog
      v-model="isDeleteDialogShown"
      width="550"
    >
      <v-card>
        <v-card-title
          class="headline"
          primary-title
        >
          {{ $t('user.account.removeTitle') }}
        </v-card-title>

        <v-card-text>
          {{ $t('user.account.removeDescription') }}
          <div style="color: grey">
            {{ $t('user.name') }}: {{ removingUserName }}
          </div>
          <div style="color: grey">
            {{ $t('user.id') }}: {{ removingProfile }}
          </div>
        </v-card-text>

        <v-divider />
        <v-card-actions>
          <v-spacer />
          <v-btn
            color="red"
            text
            @click="isDeleteDialogShown=false"
          >
            {{ $t('user.account.removeCancel') }}
          </v-btn>
          <v-btn
            color="primary"
            text
            @click="confirmRemoveProfile(); isDeleteDialogShown=false"
          >
            {{ $t('user.account.removeConfirm') }}
          </v-btn>
        </v-card-actions>
      </v-card>
    </v-dialog>
  </div>
</template>

<script lang=ts>
import { reactive, toRefs, computed, defineComponent, watch } from '@vue/composition-api'
import { useOperation, useService } from '/@/composables'
import { UserServiceKey } from '@xmcl/runtime-api'
import ChallengesForm from './UserChallengesForm.vue'
import PageSkinView from './UserSkinView.vue'
import GameProfileSpeedDial from './UserSpeedDial.vue'
import UserList from './UserList.vue'
import UserPageHeader from './UserHeader.vue'
import { useDialog } from '../composables/dialog'
import { useCurrentUser, useUserSecurityStatus, useUsers, useSwitchUser, useProfileId, useGameProfile } from '../composables/user'

export default defineComponent({
  components: {
    ChallengesForm,
    PageSkinView,
    GameProfileSpeedDial,
    UserList,
    UserPageHeader,
  },
  setup() {
    const { refreshStatus: refreshAccount, refreshSkin } = useCurrentUser()
    const { security } = useUserSecurityStatus()
    const { show: showLoginDialog } = useDialog('login')

    const { users } = useUsers()
    const { select, remove, modified, commit, userId, profileId } = useSwitchUser()
    const { gameProfile } = useProfileId(userId, profileId)
    const { name } = useGameProfile(gameProfile)
    const data = reactive({
      isChallengesDialogShown: false,
      isDeleteDialogShown: false,

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

    watch(removingProfile, (n) => {
      if (n) {
        data.isDeleteDialogShown = true
      }
    })

    watch(computed(() => data.isDeleteDialogShown), (s) => {
      if (!s) {
        removingProfile.value = ''
      }
    })

    function refresh() {
      refreshAccount()
      refreshSkin()
    }

    return {
      ...toRefs(data),
      security,
      refresh,

      loading,

      select,
      confirmSelectGameProfile,

      removingProfile,
      beginRemoveProfile,
      confirmRemoveProfile,

      users,
      userId,
      profileId,
      userModified: modified,
      name,

      removingUserName,

      showLoginDialog,
    }
  },
})
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
