<template>
  <div class="absolute z-0 h-full w-full">
    <Particles
      v-if="bgType === BackgroundType.PARTICLE"
      color="#dedede"
      class="absolute z-0 h-full w-full"
      :style="{ filter: `blur(${blur}px)` }"
      :click-mode="particleMode"
    />
    <Halo
      v-else-if="bgType === BackgroundType.HALO"
      class="absolute z-0 h-full w-full"
      :style="{ filter: `blur(${blur}px)` }"
    />
    <img
      v-else-if="bg?.type === 'image' && bgType === BackgroundType.IMAGE"
      :src="bg.url"
      class="absolute z-0 h-full w-full"
      :style="{ filter: `blur(${blur}px)`, 'object-fit': backgroundImageFit }"
    >
    <video
      v-else-if="bg?.type === 'video' && bgType === BackgroundType.VIDEO"
      ref="videoRef"
      class="absolute z-0 h-full w-full object-cover"
      :style="{ filter: `blur(${blur}px)`, 'object-fit': backgroundImageFit }"
      :src="bg.url"
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
        v-if="(backgroundColorOverlay && !isHome) || bgType === BackgroundType.NONE"
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
import { kInstance } from '@/composables/instance'
import { useSWRVModel } from '@/composables/swrv'
import { getModrinthProjectModel } from '@/composables/modrinthProject'
import { kSWRVConfig } from '@/composables/swrvConfig'

const { sideBarColor, backgroundColorOverlay, backgroundColor, blur, backgroundImage, backgroundType, particleMode, backgroundImageFit, volume, backgroundImageOverride } = injection(kTheme)
const videoRef = ref(null as null | HTMLVideoElement)
const { instance } = injection(kInstance)
const upstream = computed(() => instance.value.upstream)

const bgType = computed(() => {
  if (!!backgroundImageOverrideProject.value && upstream.value) {
    return BackgroundType.IMAGE
  }
  return backgroundType.value
})
const modrinthProject = useSWRVModel(getModrinthProjectModel(computed(() => upstream.value?.type === 'modrinth-modpack' ? upstream.value.projectId : undefined)), inject(kSWRVConfig))
const backgroundImageOverrideProject = computed(() => {
  if (modrinthProject.data.value && modrinthProject.data.value.gallery.length > 0 && upstream.value) {
    const gallery = modrinthProject.data.value.gallery
    console.log(gallery)
    return gallery[0].raw_url
  }
  return undefined
})

const bg = computed(() => {
  const bgOverride = backgroundImageOverrideProject.value
  if (bgOverride) {
    return {
      type: 'image',
      url: bgOverride,
    }
  }
  return backgroundImage.value
})

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
