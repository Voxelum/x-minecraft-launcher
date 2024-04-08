<template>
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
  <!-- :style="{ 'pointer-events': onHomePage ? 'auto' : 'none' }" -->
</template>
<script lang="ts" setup>
import Halo from '@/components/Halo.vue'
import Particles from '@/components/Particles.vue'
import { injection } from '@/util/inject'
import { kTheme, BackgroundType } from '@/composables/theme'

const { blur, backgroundImage, backgroundType, particleMode, backgroundImageFit, volume } = injection(kTheme)
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
