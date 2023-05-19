<template>
  <div
    class="flex flex-col home-page flex-1 max-h-full relative visible-scroll"
    :style="{ overflow: 'overlay' }"
    @wheel="onScroll"
  >
    <transition
      name="fade-transition"
      mode="out-in"
    >
      <HomeHeader class="sticky top-0 z-20" />
    </transition>

    <!-- <template
      v-if="!isFocusMode"
    > -->
    <!-- This is to fix strange hover color issue... -->
    <v-divider
      class="border-transparent"
    />
    <transition
      name="fade-transition"
      mode="out-in"
    >
      <router-view />
    </transition>
    <!-- </template> -->

    <HomeLogDialog />
    <HomeLaunchMultiInstanceDialog />
    <HomeLaunchStatusDialog />
    <HomeJavaIssueDialog />
    <HomeInstanceUpdateDialog />
  </div>
</template>

<script lang=ts setup>
import { kInstallList, useInstallList } from '@/composables/installList'
import { kInstanceContext, useInstanceContext } from '@/composables/instanceContext'
import { usePresence } from '@/composables/presence'
import { kCompact, useCompactScroll } from '@/composables/scrollTop'
import { useInFocusMode } from '@/composables/uiLayout'
import { useInstanceServerStatus } from '../composables/serverStatus'
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
provide(kInstallList, useInstallList())

const instance = context.instance
const { refresh } = useInstanceServerStatus(instance.value.path)
const isFocusMode = useInFocusMode()

onMounted(() => {
  if (context.isServer.value) {
    refresh()
  }
})

const { t } = useI18n()
usePresence(computed(() => t('presence.instance', {
  instance: instance.value.name,
  minecraft: instance.value.runtime.minecraft || '',
  forge: instance.value.runtime.forge || '',
  fabric: instance.value.runtime.fabricLoader || '',
})))

const compact = ref(false)
provide(kCompact, compact)
const onScroll = useCompactScroll(compact)

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
