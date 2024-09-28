<template>
  <div
    ref="containerRef"
    class="home-page visible-scroll relative flex max-h-full flex-1 flex-col overflow-x-hidden"
    :style="{ overflow: 'overlay' }"
    @wheel="onScroll"
  >
    <HomeHeader class="sticky top-0 z-20" />

    <!-- This is to fix strange hover color issue... -->
    <v-divider
      class="border-transparent"
    />
    <transition
      name="fade-transition"
      mode="out-in"
      @after-enter="end"
      @leave="start"
    >
      <router-view />
    </transition>

    <HomeLogDialog />
    <HomeLaunchMultiInstanceDialog />
    <HomeLaunchStatusDialog />
    <HomeJavaIssueDialog />
    <HomeInstanceInstallDialog />
  </div>
</template>

<script lang=ts setup>
import { kInstance } from '@/composables/instance'
import { usePresence } from '@/composables/presence'
import { kCompact, useCompactScroll } from '@/composables/scrollTop'
import { useBlockSharedTooltip } from '@/composables/sharedTooltip'
import { injection } from '@/util/inject'
import { useScroll } from '@vueuse/core'
import { useInstanceServerStatus } from '../composables/serverStatus'
import HomeHeader from './HomeHeader.vue'
import HomeInstanceInstallDialog from './HomeInstanceInstallDialog.vue'
import HomeJavaIssueDialog from './HomeJavaIssueDialog.vue'
import HomeLaunchMultiInstanceDialog from './HomeLaunchMultiInstanceDialog.vue'
import HomeLaunchStatusDialog from './HomeLaunchStatusDialog.vue'
import HomeLogDialog from './HomeLogDialog.vue'

const router = useRouter()

router.afterEach((r) => {
  document.title = `XMCL KeyStone - ${r.fullPath}`
  if (containerRef.value) {
    containerRef.value.scrollTop = 0
  }
})

const { isServer, instance } = injection(kInstance)

const { refresh } = useInstanceServerStatus(instance)
const containerRef = ref(null as null | HTMLDivElement)

onMounted(() => {
  if (isServer.value) {
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

const { start, end } = useBlockSharedTooltip()

const { arrivedState } = useScroll(containerRef)
provide('scroll', arrivedState)

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

.pointer * {
  cursor: pointer !important;
}

</style>
