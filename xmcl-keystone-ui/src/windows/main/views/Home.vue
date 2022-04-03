<template>
  <div
    class="flex flex-col home-page flex-1 min-h-0"
  >
    <home-header
      header
      class="pt-10 pl-10"
    />

    <v-flex
      v-if="isServer"
      d-flex
      xs12
      style="margin: 40px"
    >
      <server-status-bar />
    </v-flex>

    <div class="flex absolute left-0 bottom-0 px-8 pb-[20px] gap-6">
      <settings-speed-dial :refreshing="refreshing" />

      <v-tooltip
        :close-delay="0"
        top
      >
        <template #activator="{ on }">
          <v-btn
            text
            icon
            :loading="refreshing"
            v-on="on"
            @click="showExport"
          >
            <v-icon>
              share
            </v-icon>
          </v-btn>
        </template>
        {{ $t('profile.modpack.export') }}
      </v-tooltip>

      <v-tooltip top>
        <template #activator="{ on }">
          <v-btn
            text
            icon
            v-on="on"
            @click="showLogDialog"
          >
            <v-icon>
              subtitles
            </v-icon>
          </v-btn>
        </template>
        {{ $t("profile.logsCrashes.title") }}
      </v-tooltip>

      <v-tooltip top>
        <template #activator="{ on }">
          <v-btn
            text
            icon
            v-on="on"
            @click="showInstanceFolder"
          >
            <v-icon>
              folder
            </v-icon>
          </v-btn>
        </template>
        {{ $t("profile.showInstance") }}
      </v-tooltip>

      <problems-bar />
    </div>

    <home-launch-button />
    <log-dialog
      v-model="isLogDialogShown"
      :hide="hideLogDialog"
    />
    <game-exit-dialog />
    <!-- <launch-blocked-dialog /> -->
    <launch-status-dialog />
    <java-fixer-dialog />
  </div>
</template>

<script lang=ts setup>
// TODO: check this
import GameExitDialog from './AppGameExitDialog.vue'
import HomeHeader from './HomeHeader.vue'
// import LaunchBlockedDialog from './HomeLaunchBlockedDialog.vue'
import LogDialog from './HomeLogDialog.vue'
import ProblemsBar from './HomeProblemsBar.vue'
import ServerStatusBar from './HomeServerStatusBar.vue'
import SettingsSpeedDial from './HomeSettingsSpeedDial.vue'
import { useService } from '/@/composables'
import { BaseServiceKey } from '@xmcl/runtime-api'
import { useDialog } from '../composables/dialog'
import LaunchStatusDialog from './HomeLaunchStatusDialog.vue'
import JavaFixerDialog from './HomeJavaFixerDialog.vue'
import { useInstanceServerStatus } from '../composables/serverStatus'
import { useInstance } from '../composables/instance'
import { AppExportDialogKey } from '../composables/instanceExport'
import HomeLaunchButton from './HomeLaunchButton.vue'

const { show: showExport } = useDialog(AppExportDialogKey)

const { isShown: isLogDialogShown, show: showLogDialog, hide: hideLogDialog } = useDialog('log')
const { refreshing, isServer, path } = useInstance()
const { refresh } = useInstanceServerStatus(path.value)
const { openDirectory } = useService(BaseServiceKey)
function showInstanceFolder() {
  openDirectory(path.value)
}

onMounted(() => {
  if (isServer.value) {
    refresh()
  }
})
</script>

<style scoped>
.exit-button {
  position: absolute;
  right: 0;
  top: 0;
  z-index: 2;
  margin: 0;
  padding: 10px;
  cursor: pointer;
  border-radius: 2px;
  user-select: none;
}
.exit-button:hover {
  background: rgb(209, 12, 12);
}
</style>

<style>
.v-dialog__content--active {
  -webkit-app-region: no-drag;
  user-select: auto;
}
.v-dialog {
  -webkit-app-region: no-drag;
  user-select: auto;
}
.v-badge__badge.primary {
  right: -10px;
  height: 20px;
  width: 20px;
  font-size: 12px;
}

.pointer * {
  cursor: pointer !important;
}

.launch-side-button {
  /* position: absolute !important; */
  /* right: 147px; */
  /* bottom: 10px; */
  border-radius: 2px 0px 0px 2px;
  padding: 0px;
  min-width: 0px;
}

.launch-side-button .v-btn__content {
  min-width: 0px;
}
.launch-side-button i {
  font-size: 22px;
}
.launch-button {
  @apply p-10;
}
.launch-speed-dial {
  right: 147px;
  bottom: 10px;
  position: absolute;
}
.launch-speed-dial .v-speed-dial__list {
  align-items: start;
}
.launch-speed-dial .v-speed-dial__list .v-btn {
  max-width: 159px;
  min-width: 159px;
}
.home-page .more-button {
  /* position: absolute; */
  /* left: 20px; */
  /* bottom: 10px; */
  -webkit-user-drag: none;
}
</style>
