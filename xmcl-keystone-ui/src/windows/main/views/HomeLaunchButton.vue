<template>
  <v-badge
    left
    class="!absolute bottom-5 right-5"
    color="primary"
    bordered
    overlap
    :value="launchCount !== 0"
  >
    <template #badge>
      <span>{{ launchCount }}</span>
    </template>
    <v-btn
      color="primary"
      x-large
      class="!px-12 !py-6"
      @click="launchGame"
    >
      {{ $t("launch.launch") }}
      <v-icon
        v-if="launchStatus === 'idle'"
        right
      >
        play_arrow
      </v-icon>
      <v-progress-circular
        v-else
        class="v-icon--right"
        indeterminate
        :size="20"
        :width="2"
      />
    </v-btn>
  </v-badge>
</template>
<script lang="ts" setup>
import { LaunchException, UserServiceKey } from '@xmcl/runtime-api'
import { useDialog } from '../composables/dialog'
import { useJava } from '../composables/java'
import { useLaunch } from '../composables/launch'
import { JavaFixDialogKey } from './HomeJavaFixerDialog.vue'
import { LaunchStatusDialogKey } from './HomeLaunchStatusDialog.vue'
import { useService } from '/@/composables'

const { launch, status: launchStatus, launchCount } = useLaunch()
const { missing: missingJava } = useJava()
const { show: showLoginDialog } = useDialog('login')
const { show: showJavaDialog } = useDialog(JavaFixDialogKey)
const { show: showLaunchBlockedDialog } = useDialog('launch-blocked')
const { show: showLaunchStatusDialog } = useDialog(LaunchStatusDialogKey)

const { state } = useService(UserServiceKey)
const userProfiles = computed(() => Object.values(state.users))

function launchGame() {
  if (missingJava.value) {
    showJavaDialog()
  } if (!state.users[state.selectedUser.id] || !state.user.accessToken) {
    showLoginDialog()
  } else if (launchStatus.value === 'checkingProblems' || launchStatus.value === 'launching') {
    showLaunchStatusDialog()
  } else {
    launch().catch((e: LaunchException) => {
      if (e.type === 'launchBlockedIssues') {
        showLaunchBlockedDialog()
      } else if (e.type === 'launchGeneralException') {
        // TODO: support this
      } else if (e.type === 'launchNoVersionInstalled') {
        // TODO: implement this
      }
    })
  }
}
</script>
