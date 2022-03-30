<template>
  <img
    v-if="backgroundType === BackgroundType.IMAGE"
    :src="backgroundImage"
    class="absolute h-full w-full z-0"
    :style="{ filter: `blur(${blur}px)`, 'object-fit': backgroundImageFit }"
  >
  <video
    v-else-if="backgroundType === BackgroundType.VIDEO"
    ref="video"
    class="absolute h-full w-full z-0 object-cover"
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
<script lang="ts">
import Halo from '/@/components/Halo.vue'
import Particles from '/@/components/Particles.vue'
import { BackgroundType, useBackground } from '../composables/background'

export default defineComponent({
  components: {
    Halo,
    Particles,
  },
  setup() {
    const { blur, backgroundImage, backgroundType, particleMode, backgroundImageFit, backgroundVideo, volume } = useBackground()
    const video = ref(null as null | HTMLVideoElement)

    watch(volume, (newVolume) => {
      if (video.value) {
        video.value.volume = newVolume
      }
    })
    onMounted(() => {
      if (video.value) {
        video.value.volume = volume.value
      }
    })
    return {
      blur, backgroundImage, backgroundType, particleMode, backgroundImageFit, backgroundVideo, BackgroundType,
    }
  },
})

</script>
