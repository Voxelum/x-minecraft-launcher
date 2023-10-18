<template>
  <img
    v-if="backgroundType === BackgroundType.IMAGE"
    :src="backgroundImage"
    class="absolute z-0 h-full w-full"
    :style="{ filter: `blur(${blur}px)`, 'object-fit': backgroundImageFit }"
  >
  <video
    v-else-if="backgroundType === BackgroundType.VIDEO"
    ref="videoRef"
    class="absolute z-0 h-full w-full object-cover"
    :style="{ filter: `blur(${blur}px)`, 'object-fit': backgroundImageFit }"
    :src="backgroundVideo"
    autoplay
    loop
  />
  <Particles
    v-else-if="backgroundType === BackgroundType.PARTICLE"
    color="#dedede"
    class="absolute z-0 h-full w-full"
    :style="{ filter: `blur(${blur}px)` }"
    :click-mode="particleMode"
  />
  <Halo
    v-else-if="backgroundType === BackgroundType.HALO"
    :style="{ filter: `blur(${blur}px)` }"
  />
  <!-- :style="{ 'pointer-events': onHomePage ? 'auto' : 'none' }" -->
</template>
<script lang="ts" setup>
import Halo from '@/components/Halo.vue'
import Particles from '@/components/Particles.vue'
import { injection } from '@/util/inject'
import { BackgroundType, kBackground } from '../composables/background'

const { blur, backgroundImage, backgroundType, particleMode, backgroundImageFit, backgroundVideo, volume } = injection(kBackground)
const videoRef = ref(null as null | HTMLVideoElement)

watch(volume, (newVolume) => {
  if (videoRef.value) {
    videoRef.value.volume = newVolume
  }
})
onMounted(() => {
  if (videoRef.value) {
    videoRef.value.volume = volume.value
  }
})

</script>
