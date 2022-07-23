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
import { UserServiceKey } from '@xmcl/runtime-api'
import { useDialog } from '../composables/dialog'
import { JavaIssueDialogKey, useJava } from '../composables/java'
import { LaunchStatusDialogKey, useLaunch } from '../composables/launch'
import { LoginDialog } from '../composables/login'
import { useService } from '/@/composables'

const { launch, status: launchStatus, launchCount } = useLaunch()
const { missing: missingJava } = useJava()
const { show: showLoginDialog } = useDialog(LoginDialog)
const { show: showJavaDialog } = useDialog(JavaIssueDialogKey)
const { show: showLaunchStatusDialog } = useDialog(LaunchStatusDialogKey)
const { show: showMultiInstanceDialog } = useDialog('multi-instance-launch')

const { state } = useService(UserServiceKey)

function launchGame() {
  if (missingJava.value) {
    showJavaDialog()
  } if (!state.users[state.selectedUser.id] || !state.user?.accessToken) {
    showLoginDialog(true)
  } else if (launchStatus.value === 'checkingProblems' || launchStatus.value === 'launching') {
    showLaunchStatusDialog()
  } else {
    if (launchCount.value === 1 || launchStatus.value !== 'idle') {
      showMultiInstanceDialog()
    } else {
      launch()
    }
  }
}
</script>
