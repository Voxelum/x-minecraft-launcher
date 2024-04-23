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
          style="filter: blur(3px);"
          :src="backgroundImageOverride"
          class="z-1 absolute h-full w-full"
        >
      </transition>
      <div class="img-container" />
    </template>

    <div
      v-if="backgroundColorOverlay"
      class="z-3 absolute h-full w-full"
      :style="{ 'background': backgroundColor }"
    />
  </div>
</template>
<script lang="ts" setup>
import Halo from '@/components/Halo.vue'
import Particles from '@/components/Particles.vue'
import { injection } from '@/util/inject'
import { kTheme, BackgroundType } from '@/composables/theme'

const { sideBarColor, backgroundColorOverlay, backgroundColor, blur, backgroundImage, backgroundType, particleMode, backgroundImageFit, volume, backgroundImageOverride } = injection(kTheme)
const videoRef = ref(null as null | HTMLVideoElement)

watch(volume, (newVolume) => {
  if (videoRef.value) {
    videoRef.value.volume = newVolume
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

watch(backgroundType, (t) => {
  console.log(t)
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
