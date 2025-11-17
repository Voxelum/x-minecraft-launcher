<template>
  <div class="absolute z-0 h-full w-full">
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
      @error="onHaloError"
    />
    <img
      v-else-if="backgroundImage?.type === 'image' && backgroundType === BackgroundType.IMAGE"
      :src="backgroundImage.url"
      class="absolute z-0 h-full w-full"
      :style="{ filter: `blur(${blur}px)`, 'object-fit': backgroundImageFit }"
    >
    <video
      v-else-if="backgroundImage?.type === 'video' && backgroundType === BackgroundType.VIDEO"
      ref="videoRef"
      class="absolute z-0 h-full w-full object-cover"
      :style="{ filter: `blur(${blur}px)`, 'object-fit': backgroundImageFit }"
      :src="backgroundImage.url"
      autoplay
      loop
    />
    <template
      v-if="backgroundImageOverride"
    >
      <transition
        name="fade-transition"
      >
        <img
          :key="backgroundImageOverride"
          :src="backgroundImageOverride"
          class="z-1 absolute h-full w-full"
        >
      </transition>
      <div class="img-container" />
    </template>

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
import { injection } from '@/util/inject'
import { kTheme, BackgroundType } from '@/composables/theme'
import { kInstanceLaunch } from '@/composables/instanceLaunch'

const { sideBarColor, backgroundColorOverlay, backgroundColor, blur, backgroundImage, backgroundType, particleMode, backgroundImageFit, volume, backgroundImageOverride } = injection(kTheme)
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

  // Listen for GPU process crashes and automatically disable resource-intensive backgrounds
  if (window.windowController) {
    window.windowController.on('gpu-process-crashed', (details: any) => {
      console.error('GPU process crashed, disabling halo background:', details)
      if (backgroundType.value === BackgroundType.HALO) {
        backgroundType.value = BackgroundType.NONE
      }
    })
  }
})

watch(backgroundType, (t) => {
  console.log(t)
})

// Handle Halo initialization errors by falling back to a simpler background
const onHaloError = (error: Error) => {
  console.error('Halo background failed to initialize, falling back to none:', error)
  // Automatically switch to a simpler background type to prevent GPU issues
  backgroundType.value = BackgroundType.NONE
}

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
