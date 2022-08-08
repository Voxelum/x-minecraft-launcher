<template>
  <div
    class="flex flex-col home-page flex-1 min-h-0 overflow-auto max-h-full"
  >
    <home-header
      class="pt-10 pb-5 px-10"
    />
    <v-divider class="mx-4" />
    <!-- This is to fix strange hover color issue... -->
    <v-divider class="border-transparent" />
    <span class="flex flex-wrap p-10 flex-grow-0 gap-3 items-start">
      <home-mod-card />
      <home-resource-packs-card />
      <home-shader-pack-card />
      <home-saves-card />
      <home-problem-card />
      <server-status-bar v-if="isServer" />
    </span>

    <div class="flex absolute left-0 bottom-0 px-8 pb-[20px] gap-6">
      <home-sync-button />
    </div>

    <log-dialog />
    <game-exit-dialog />
    <app-launch-blocked-dialog />
    <home-launch-multi-instance-dialog />
    <launch-status-dialog />
    <java-fixer-dialog />
    <home-sync-dialog />
  </div>
</template>

<script lang=ts setup>
import { BaseServiceKey } from '@xmcl/runtime-api'
import { useInstance } from '../composables/instance'
import { useInstanceServerStatus } from '../composables/serverStatus'
import GameExitDialog from './AppGameExitDialog.vue'
import AppLaunchBlockedDialog from './AppLaunchBlockedDialog.vue'
import HomeHeader from './HomeHeader.vue'
import JavaFixerDialog from './HomeJavaIssueDialog.vue'
import HomeLaunchMultiInstanceDialog from './HomeLaunchMultiInstanceDialog.vue'
import LaunchStatusDialog from './HomeLaunchStatusDialog.vue'
import LogDialog from './HomeLogDialog.vue'
import HomeModCard from './HomeModCard.vue'
import HomeProblemCard from './HomeProblemCard.vue'
import HomeResourcePacksCard from './HomeResourcePacksCard.vue'
import HomeSavesCard from './HomeSavesCard.vue'
import ServerStatusBar from './HomeServerStatusBar.vue'
import HomeShaderPackCard from './HomeShaderPackCard.vue'
import HomeSyncButton from './HomeSyncButton.vue'
import HomeSyncDialog from './HomeSyncDialog.vue'
import { useRouter, useService } from '/@/composables'

const router = useRouter()

router.afterEach((r) => {
  document.title = `XMCL KeyStone - ${r.fullPath}`
})

const { refreshing, isServer, path } = useInstance()
const { refresh } = useInstanceServerStatus(path.value)
const { openDirectory } = useService(BaseServiceKey)

onMounted(() => {
  if (isServer.value) {
    refresh()
  }
})
</script>

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

.launch-button {
  @apply p-10;
}
</style>
