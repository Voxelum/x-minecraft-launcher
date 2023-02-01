<template>
  <div
    class="flex flex-col home-page flex-1 min-h-0 overflow-auto max-h-full"
  >
    <HomeHeader
      class="pt-10 mb-4 sticky top-0 z-10"
      :focus-mode="isFocusMode"
    />

    <template
      v-if="!isFocusMode"
    >
      <!-- This is to fix strange hover color issue... -->
      <v-divider
        class="border-transparent"
      />
      <HomeCardHost
        :is-server="isServer"
        :instance="instance"
      />
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
    <HomeInstanceUpdateDialog />
  </div>
</template>

<script lang=ts setup>
import { kInstanceContext, useInstanceContext } from '@/composables/instanceContext'
import { usePresence } from '@/composables/presence'
import { useInFocusMode } from '@/composables/uiLayout'
import { useInstanceIsServer } from '../composables/instance'
import { useInstanceServerStatus } from '../composables/serverStatus'
import AppGameExitDialog from './AppGameExitDialog.vue'
import AppLaunchBlockedDialog from './AppLaunchBlockedDialog.vue'
import HomeCardHost from './HomeCardHost.vue'
import HomeFocusFooter from './HomeFocusFooter.vue'
import HomeHeader from './HomeHeader.vue'
import HomeInstanceUpdateDialog from './HomeInstanceUpdateDialog.vue'
import HomeJavaIssueDialog from './HomeJavaIssueDialog.vue'
import HomeLaunchMultiInstanceDialog from './HomeLaunchMultiInstanceDialog.vue'
import HomeLaunchStatusDialog from './HomeLaunchStatusDialog.vue'
import HomeLogDialog from './HomeLogDialog.vue'

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

usePresence(computed(() => ({
  location: 'instance',
  instance: instance.value.name,
  minecraft: instance.value.runtime.minecraft || '',
  forge: instance.value.runtime.forge || '',
  fabric: instance.value.runtime.fabricLoader || '',
})))
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
