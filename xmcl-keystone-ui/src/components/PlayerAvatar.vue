<template>
  <div
    style="overflow: hidden"
    :style="{ 'max-width': `${dimension}px`, 'max-height': `${dimension}px`, 'min-height': `${dimension}px`, 'min-width': `${dimension}px` }"
  >
    <img
      :src="dataUrlSrc"
      :width="dimension"
      :height="dimension"
      style="image-rendering: pixelated; border-radius: 0"
      :style="{ width: `${dimension}px`, height: `${dimension}px` }"
    >
  </div>
</template>

<script lang=ts setup>
import steve from '@/assets/steve_skin.png'
import { renderMinecraftPlayerTextHead } from '@/util/avatarRenderer'
import { ref } from 'vue'

const props = withDefaults(
  defineProps<{
    src: string
    dimension: number
  }>(), {
  src: steve,
  dimension: 64,
})

const steveSrc = renderMinecraftPlayerTextHead(steve)

watch(() => props.src, (s) => {
  renderMinecraftPlayerTextHead(s)?.then((v) => {
    dataUrlSrc.value = v
  }, () => {
    steveSrc?.then((v) => {
      if (!dataUrlSrc.value) {
        dataUrlSrc.value = v
      }
    })
  })
}, { immediate: true })

const dataUrlSrc = ref('')
</script>

<style></style>
