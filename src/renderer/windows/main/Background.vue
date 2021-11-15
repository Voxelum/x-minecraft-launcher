<template>
  <img
    v-if="backgroundType === BackgroundType.IMAGE"
    :src="backgroundImage"
    class="absolute h-full w-full z-0"
    :style="{ filter: `blur(${blur}px)` }"
  />
  <Particles
    v-else-if="backgroundType === BackgroundType.PARTICLE"
    color="#dedede"
    class="absolute w-full h-full z-0"
    :style="{ filter: `blur(${blur}px)` }"
    :click-mode="particleMode"
  />
  <Halo v-else-if="backgroundType === BackgroundType.HALO" :style="{ filter: `blur(${blur}px)` }" />
  <!-- :style="{ 'pointer-events': onHomePage ? 'auto' : 'none' }" -->
</template>
<script lang="ts">
import { defineComponent, onMounted } from '@vue/composition-api'
import Halo from '/@/components/Halo.vue'
import { BackgroundType, useBackground } from '/@/hooks'
import Particles from '../../components/Particles.vue'

export default defineComponent({
  setup() {
    const { blur, backgroundImage, backgroundType, particleMode } = useBackground()
    onMounted(() => {
      // watch(backgroundImage, () => {
      //   refreshImage()
      // })
      // watch(particleMode, () => {
      //   if (showParticle.value) {
      //     showParticle.value = false
      //     setImmediate(() => {
      //       showParticle.value = true
      //     })
      //   }
      // })
      // app.value!.$el.classList.add(state.platform)
    });
    return {
      BackgroundType,
      particleMode,
      backgroundImage,
      blur,
      backgroundType,
    };
  },
  components: { Halo, Particles }
})

</script>