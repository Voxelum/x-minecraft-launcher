<template>
  <img
    v-if="backgroundType === BackgroundType.IMAGE"
    :src="backgroundImage"
    class="absolute h-full w-full z-0"
    :style="{ filter: `blur(${blur}px)`, 'object-fit': backgroundImageFit }"
  >
  <video
    v-else-if="backgroundType === BackgroundType.VIDEO"
    ref="videoRef"
    class="absolute h-full w-full z-0 object-cover"
    :style="{ filter: `blur(${blur}px)`, 'object-fit': backgroundImageFit }"
    :src="backgroundVideo"
    autoplay
    loop
  />
  <Particles
    v-else-if="backgroundType === BackgroundType.PARTICLE"
    color="#dedede"
    class="absolute w-full h-full z-0"
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
import { BackgroundType, useBackground } from '../composables/background'
import { Ref } from 'vue'

const { blur, backgroundImage, backgroundType, particleMode, backgroundImageFit, backgroundVideo, volume } = useBackground()
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
