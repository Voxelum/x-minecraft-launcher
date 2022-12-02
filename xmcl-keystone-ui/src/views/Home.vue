<template>
  <div
    class="flex flex-col home-page flex-1 min-h-0 overflow-auto max-h-full"
  >
    <HomeHeader
      class="pt-10 pb-5 px-10"
    />
    <template
      v-if="!isFocusMode"
    >
      <v-divider class="mx-4" />
      <!-- This is to fix strange hover color issue... -->
      <v-divider
        class="border-transparent"
      />
      <span
        class="flex flex-wrap p-10 flex-grow-0 gap-3 items-start"
      >
        <HomeModCard />
        <HomeResourcePacksCard />
        <HomeShaderPackCard />
        <HomeSavesCard />
        <HomeServerStatusBar v-if="isServer" />
      <!-- <HomeModrinthCard
        v-if="instance.upstream && instance.upstream.type === 'modrinth-modpack'"
        :path="instance.path"
        :upstream="instance.upstream"
        /> -->
      </span>
    </template>

    <HomeFocusFooter
      v-if="isFocusMode"
      class="flex absolute left-0 bottom-0 px-8 pb-[26px] gap-6"
    />

    <HomeLogDialog />
    <AppGameExitDialog />
    <AppLaunchBlockedDialog />
    <HomeLaunchMultiInstanceDialog />
    <HomeLaunchStatusDialog />
    <HomeJavaIssueDialog />
    <!-- <home-sync-dialog /> -->
    <HomeInstallInstanceDialog />
  </div>
</template>

<script lang=ts setup>
import { kInstanceContext, useInstanceContext } from '@/composables/instanceContext'
import { useInFocusMode } from '@/composables/uiLayout'
import { useInstanceIsServer } from '../composables/instance'
import { useInstanceServerStatus } from '../composables/serverStatus'
import AppGameExitDialog from './AppGameExitDialog.vue'
import AppLaunchBlockedDialog from './AppLaunchBlockedDialog.vue'
import HomeFocusFooter from './HomeFocusFooter.vue'
import HomeHeader from './HomeHeader.vue'
import HomeInstallInstanceDialog from './HomeInstallInstanceDialog.vue'
import HomeJavaIssueDialog from './HomeJavaIssueDialog.vue'
import HomeLaunchMultiInstanceDialog from './HomeLaunchMultiInstanceDialog.vue'
import HomeLaunchStatusDialog from './HomeLaunchStatusDialog.vue'
import HomeLogDialog from './HomeLogDialog.vue'
import HomeModCard from './HomeModCard.vue'
import HomeResourcePacksCard from './HomeResourcePacksCard.vue'
import HomeSavesCard from './HomeSavesCard.vue'
import HomeServerStatusBar from './HomeServerStatusBar.vue'
import HomeShaderPackCard from './HomeShaderPackCard.vue'

const router = useRouter()

router.afterEach((r) => {
  document.title = `XMCL KeyStone - ${r.fullPath}`
})

const context = useInstanceContext()

provide(kInstanceContext, context)

const instance = context.instance
const isServer = useInstanceIsServer(instance)
const { refresh } = useInstanceServerStatus(instance.value.path)
const isFocusMode = useInFocusMode()

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
