<template>
  <v-container
    fluid
    grid-list-md
    fill-height
    style="flex-direction: column"
  >
    <v-toolbar
      dark
      flat
      color="transparent"
    >
      <v-toolbar-title>{{ $tc('user.info', 2) }}</v-toolbar-title>
      <v-spacer />

      <v-tooltip bottom>
        <template #activator="{ on }">
          <v-btn
            icon
            large
            v-on="on"
            @click="isUserServicesDialogShown = true"
          >
            <v-icon>add_location</v-icon>
          </v-btn>
        </template>
        {{ $t('user.service.add') }}
      </v-tooltip>
      <v-tooltip bottom>
        <template #activator="{ on }">
          <v-btn
            icon
            large
            v-on="on"
            @click="refresh"
          >
            <v-icon>refresh</v-icon>
          </v-btn>
        </template>
        {{ $t('user.refreshAccount') }}
      </v-tooltip>
      <v-tooltip bottom>
        <template #activator="{ on }">
          <v-btn
            icon
            large
            v-on="on"
            @click="showLoginDialog"
          >
            <v-icon>person_add</v-icon>
          </v-btn>
        </template>
        {{ $t('user.account.add') }}
      </v-tooltip>
    </v-toolbar>
    <v-layout
      row
      fill-height
      style="width: 100%"
    >
      <v-flex xs9>
        <v-layout
          column
          fill-height
          style="position: relative"
        >
          <v-flex
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
          </v-flex>
          <v-flex style="height: 100%; overflow: auto">
            <user-list
              :user-id="userId"
              :profile-id="profileId"
              :users="users"
              :select="select"
              @dragstart="dragged=true"
              @dragend="dragged=false"
            />
          </v-flex>

          <game-profile-speed-dial
            :visibled="userModified || dragged"
            :deleting="dragged"
            :loading="loading"
            @click="confirmSelectGameProfile"
            @dragover.prevent
            @drop="beginRemoveProfile($event.dataTransfer.getData('id'))"
          />
        </v-layout>
      </v-flex>
      <v-flex grow />
      <v-flex shrink>
        <v-layout
          style="position: relative"
          justify-center
          align-center
          fill-height
        >
          <page-skin-view
            :user-id="userId"
            :profile-id="profileId"
            :name="name"
          />
        </v-layout>
      </v-flex>
      <v-flex grow />
    </v-layout>
    <v-dialog
      v-model="isChallengesDialogShown"
      width="500"
    >
      <challenges-form :show="isChallengesDialogShown" />
    </v-dialog>
    <v-dialog
      v-model="isUserServicesDialogShown"
      width="550"
      persistence
    >
      <v-toolbar color="primary">
        <h2>{{ $t('user.service.title') }}</h2>
        <v-spacer />
        <v-toolbar-items>
          <v-btn
            icon
            flat
            @click="isUserServicesDialogShown = false"
          >
            <v-icon>close</v-icon>
          </v-btn>
        </v-toolbar-items>
      </v-toolbar>
      <user-services-card />
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
            flat
            @click="isDeleteDialogShown=false"
          >
            {{ $t('user.account.removeCancel') }}
          </v-btn>
          <v-btn
            color="primary"
            flat
            @click="confirmRemoveProfile(); isDeleteDialogShown=false"
          >
            {{ $t('user.account.removeConfirm') }}
          </v-btn>
        </v-card-actions>
      </v-card>
    </v-dialog>
  </v-container>
</template>

<script lang=ts>
import { reactive, toRefs, computed, defineComponent, watch } from '@vue/composition-api'
import {
  useCurrentUser,
  useSwitchUser,
  useUsers,
  useOperation,
  useUserSecurityStatus,
  useGameProfile,
  useProfileId,
  useStore,
} from '/@/hooks'
import { useLoginDialog, useDialog } from '../hooks'
import ChallengesForm from './UserPageChallengesForm.vue'
import PageSkinView from './UserPageSkinView.vue'
import UserServicesCard from './UserPageUserServicesCard.vue'
import GameProfileSpeedDial from './UserPageGameProfileSpeedDial.vue'
import UserList from './UserPageUserList.vue'

export default defineComponent({
  components: {
    ChallengesForm,
    UserServicesCard,
    PageSkinView,
    GameProfileSpeedDial,
    UserList,
  },
  setup() {
    const { refreshStatus: refreshAccount, refreshSkin } = useCurrentUser()
    const { security } = useUserSecurityStatus()
    const { show: showLoginDialog } = useLoginDialog()
    const { show: showUserServiceDialog } = useDialog('user-service')

    const { users } = useUsers()
    const { select, remove, modified, commit, userId, profileId } = useSwitchUser()
    const { gameProfile } = useProfileId(userId, profileId)
    const { name } = useGameProfile(gameProfile)
    const data = reactive({
      isChallengesDialogShown: false,
      isUserServicesDialogShown: false,
      isDeleteDialogShown: false,

      selecting: false,
      deleting: false,
      dragged: false,
    })
    const loading = computed(() => data.selecting || data.deleting)
    const { begin: beginRemoveProfile, operate: confirmRemoveProfile, data: removingProfile, cancel: cancelRemoveProfile } = useOperation('', (v) => remove(v))

    const { state } = useStore()
    const removingUserName = computed(() => state.user.users[removingProfile.value]?.username ?? '')

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
      cancelRemoveProfile,
      showUserServiceDialog,

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
