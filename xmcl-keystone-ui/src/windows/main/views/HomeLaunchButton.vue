<template>
  <v-badge
    left
    color="primary"
    bordered
    overlap
    :value="launchCount !== 0"
  >
    <template #badge>
      <span>{{ launchCount }}</span>
    </template>
    <v-btn
      :color="color"
      x-large
      class="!px-12 !py-6 text-lg"
      :loading="loading"
      @click="onClick()"
    >
      <template v-if="!!issue">
        <template
          v-if="status !== 1"
        >
          <v-icon
            class="text-2xl -ml-1 pr-2"
          >
            get_app
          </v-icon>
          {{ t('install' ) }}
        </template>
        <template v-else>
          <v-icon
            class="text-2xl -ml-1 pr-2"
          >
            pause
          </v-icon>
          {{ t('task.pause') }}
        </template>
      </template>
      <template v-else>
        {{ t("launch.launch") }}
        <v-icon
          v-if="launchStatus === 'idle'"
          class="text-2xl pl-3"
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
      </template>
    </v-btn>
  </v-badge>
</template>
<script lang="ts" setup>
import { Ref } from '@vue/composition-api'
import { InstanceFile, InstanceIOServiceKey, Issue, TaskState, UserServiceKey } from '@xmcl/runtime-api'
import { useDialog } from '../composables/dialog'
import { JavaIssueDialogKey, useJava } from '../composables/java'
import { LaunchStatusDialogKey, useLaunch } from '../composables/launch'
import { LoginDialog } from '../composables/login'
import { useBusy, useI18n, useIssues, useRefreshable, useService, useServiceBusy } from '/@/composables'

const emit = defineEmits(['pause', 'resume'])
const props = defineProps<{
  status: TaskState
  issue: Issue | undefined
}>()

const { launch, status: launchStatus, launchCount } = useLaunch()
const { missing: missingJava } = useJava()
const { show: showLoginDialog } = useDialog(LoginDialog)
const { show: showJavaDialog } = useDialog(JavaIssueDialogKey)
const { show: showLaunchStatusDialog } = useDialog(LaunchStatusDialogKey)
const { show: showMultiInstanceDialog } = useDialog('multi-instance-launch')
const { t } = useI18n()
const { state } = useService(UserServiceKey)
const { issues, fix } = useIssues()
const { checkInstanceInstall, installInstanceFiles } = useService(InstanceIOServiceKey)

const pendingInstallFiles: Ref<InstanceFile[]> = ref([])

const diagnosingVersion = useBusy('diagnoseVersion')
const checkingInstall = useServiceBusy(InstanceIOServiceKey, 'checkInstanceInstall')
const loading = computed(() => diagnosingVersion.value || checkingInstall.value)

const needInstall = computed(() => !!props.issue || pendingInstallFiles.value.length > 0)
const color = computed(() => needInstall.value || diagnosingVersion.value ? 'blue' : 'primary')

const { refresh: refreshInstanceInstall } = useRefreshable(async () => {
  const files = await checkInstanceInstall()
  pendingInstallFiles.value = files
})

onMounted(() => {
  refreshInstanceInstall()
})

function onClick() {
  // related task need to handle
  if (needInstall.value) {
    if (props.status === TaskState.Running) {
      emit('pause')
    } else if (props.status === TaskState.Paused) {
      emit('resume')
    } else {
      if (props.issue) {
        // has issue
        fix(props.issue, issues.value)
      }
      if (pendingInstallFiles.value.length > 0) {
        // has unfinished files
        installInstanceFiles({
          files: pendingInstallFiles.value,
        })
      }
    }
  } else if (missingJava.value) {
    // missing java
    showJavaDialog()
  } else if (!state.users[state.selectedUser.id] || !state.user?.accessToken) {
    // need to login
    showLoginDialog(true)
  } else if (launchStatus.value === 'checkingProblems' || launchStatus.value === 'launching') {
    // during launching
    showLaunchStatusDialog()
  } else if (launchCount.value === 1 || launchStatus.value !== 'idle') {
    // already launched, need to show dialog
    showMultiInstanceDialog()
  } else {
    launch()
  }
}

</script>
