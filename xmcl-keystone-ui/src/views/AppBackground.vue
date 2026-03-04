<template>
  <div class="absolute z-0 h-full w-full">
    <transition
      name="fade-transition"
    >
      <Particles
        v-if="backgroundType === BackgroundType.PARTICLE"
        color="#dedede"
        class="absolute z-0 h-full w-full"
        :style="{ filter: `blur(${blur}px)` }"
        :click-mode="particleMode"
      />
      <Halo
        v-else-if="backgroundType === BackgroundType.HALO"
        class="absolute z-0 h-full w-full"
        :style="{ filter: `blur(${blur}px)` }"
      />
      <img
        v-else-if="backgroundImage?.type === 'image' && backgroundType === BackgroundType.IMAGE"
        :key="backgroundImage.url"
        :src="backgroundImage.url"
        class="absolute z-0 h-full w-full"
        :style="{ filter: `blur(${blur}px)`, 'object-fit': backgroundImageFit }"
      >
      <video
        v-else-if="backgroundImage?.type === 'video' && backgroundType === BackgroundType.VIDEO"
        ref="videoRef"
        :key="`video-${backgroundImage.url}`"
        class="absolute z-0 h-full w-full object-cover"
        :style="{ filter: `blur(${blur}px)`, 'object-fit': backgroundImageFit }"
        :src="backgroundImage.url"
        autoplay
        loop
      />
      <img
        v-else-if="backgroundType === BackgroundType.SCREENSHOT && currentScreenshot"
        :key="currentScreenshot"
        :src="currentScreenshot"
        class="absolute z-0 h-full w-full"
        :style="{ filter: `blur(${blur}px)`, 'object-fit': backgroundImageFit }"
      >
    </transition>

    <transition
      name="fade-transition"
    >
      <div
        v-if="(backgroundColorOverlay && !isHome) || backgroundType === BackgroundType.NONE"
        class="z-3 absolute h-full w-full"
        :style="{ 'background': backgroundColor }"
      />
    </transition>
  </div>
</template>
<script lang="ts" setup>
import Halo from '@/components/Halo.vue'
import Particles from '@/components/Particles.vue'
import { kInstance } from '@/composables/instance'
import { kInstanceLaunch } from '@/composables/instanceLaunch'
import { useInstanceScreenshots } from '@/composables/screenshot'
import { BackgroundType, kTheme } from '@/composables/theme'
import { injection } from '@/util/inject'

const { sideBarColor, backgroundColorOverlay, backgroundColor, blur, backgroundImage, backgroundType, particleMode, backgroundImageFit, volume } = injection(kTheme)
const videoRef = ref(null as null | HTMLVideoElement)

const route = useRoute()
const isHome = computed(() => route.path === '/')

watch(volume, (newVolume) => {
  if (videoRef.value) {
    videoRef.value.volume = newVolume
  }
})

const { gameProcesses } = injection(kInstanceLaunch)

watch(computed(() => gameProcesses.value.length), (cur, last) => {
  if (cur > 0 && last === 0) {
    videoRef.value?.pause()
  } else if (cur === 0 && last > 0) {
    videoRef.value?.play()
  }
})

watch(videoRef, (v) => {
  if (v) {
    v.volume = volume.value
  }
})

onMounted(() => {
  if (videoRef.value) {
    videoRef.value.volume = volume.value
  }
})

// Screenshot background support
const { path: instancePath } = injection(kInstance)
const { urls: screenshotUrls } = useInstanceScreenshots(instancePath)

const screenshotIndex = ref(0)

const currentScreenshot = computed(() => {
  if (screenshotUrls.value.length === 0) return undefined
  return screenshotUrls.value[screenshotIndex.value % screenshotUrls.value.length]
})

let screenshotTimer: ReturnType<typeof setInterval> | undefined

function initScreenshotIndex() {
  screenshotIndex.value = screenshotUrls.value.length > 0
    ? Math.floor(Math.random() * screenshotUrls.value.length)
    : 0
}

function startScreenshotCycle() {
  stopScreenshotCycle()
  if (screenshotUrls.value.length > 1) {
    screenshotTimer = setInterval(() => {
      screenshotIndex.value = (screenshotIndex.value + 1) % screenshotUrls.value.length
    }, 30000)
  }
}

function stopScreenshotCycle() {
  if (screenshotTimer !== undefined) {
    clearInterval(screenshotTimer)
    screenshotTimer = undefined
  }
}

watch(backgroundType, (t) => {
  if (t === BackgroundType.SCREENSHOT) {
    initScreenshotIndex()
    startScreenshotCycle()
  } else {
    stopScreenshotCycle()
  }
})

watch(screenshotUrls, (urls, oldUrls) => {
  if (backgroundType.value === BackgroundType.SCREENSHOT) {
    if (urls.length > 0 && screenshotIndex.value >= urls.length) {
      screenshotIndex.value = 0
    }
    // Only restart cycle when screenshot count crosses the threshold of needing a timer
    const hadMultiple = (oldUrls?.length ?? 0) > 1
    const hasMultiple = urls.length > 1
    if (hasMultiple && !hadMultiple) {
      startScreenshotCycle()
    } else if (!hasMultiple) {
      stopScreenshotCycle()
    }
  }
})

onMounted(() => {
  if (backgroundType.value === BackgroundType.SCREENSHOT) {
    initScreenshotIndex()
    startScreenshotCycle()
  }
})

onUnmounted(() => {
  stopScreenshotCycle()
})
</script>
<style scoped>
.img-container {
  background: radial-gradient(ellipse at top right, transparent, v-bind(sideBarColor) 72%);
  position: absolute;
  min-width: 100%;
  min-height: 100%;
  z-index: 4;
}
</style>
