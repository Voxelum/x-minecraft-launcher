<template>
  <div
    ref="containerRef"
    class="home-page visible-scroll relative flex max-h-full flex-1 flex-col overflow-x-hidden"
    :style="{ scrollbarGutter: 'stable' }"
    @wheel="onScroll"
  >
    <HomeHeader ref="headerEl" class="sticky top-0 z-20" />

    <!-- This is to fix strange hover color issue... -->
    <transition
      name="fade-transition"
      mode="out-in"
      @after-enter="end"
      @leave="start"
    >
      <router-view />
    </transition>

    <HomeLogDialog />
    <HomeDropModpackDialog />
    <HomeLaunchMultiInstanceDialog />
    <HomeLaunchStatusDialog />
    <HomeInstanceInstallDialog />
    <AppCollectionDialog />
  </div>
</template>

<script lang=ts setup>
import { kInstance } from '@/composables/instance'
import { usePresence } from '@/composables/presence'
import { kCompact, useCompactScroll } from '@/composables/scrollTop'
import { useBlockSharedTooltip } from '@/composables/sharedTooltip'
import { injection } from '@/util/inject'
import { useElementBounding, useElementSize, useScroll } from '@vueuse/core'
import { useInstanceServerStatus } from '../composables/serverStatus'
import HomeHeader from './HomeHeader.vue'
import HomeInstanceInstallDialog from './HomeInstanceInstallDialog.vue'
import HomeLaunchMultiInstanceDialog from './HomeLaunchMultiInstanceDialog.vue'
import HomeLaunchStatusDialog from './HomeLaunchStatusDialog.vue'
import HomeLogDialog from './HomeLogDialog.vue'
import AppCollectionDialog from './AppCollectionDialog.vue'
import HomeDropModpackDialog from './HomeDropModpackDialog.vue'

const router = useRouter()

router.afterEach((r) => {
  document.title = `XMCL KeyStone - ${r.fullPath}`
  if (containerRef.value) {
    containerRef.value.scrollTop = 0
  }
})

const headerEl = ref(null as null | HTMLDivElement)
const { height } = useElementBounding(headerEl)
const hightTracker = inject('headerHeight', ref(0))
watch(height, (h) => {
  hightTracker.value = h
}, { immediate: true })

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

const compact = injection(kCompact)
const onScroll = useCompactScroll(compact)

const { start, end } = useBlockSharedTooltip()

const { arrivedState } = useScroll(containerRef)
provide('scroll', arrivedState)

// Scroll
provide('scrollElement', containerRef)
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
