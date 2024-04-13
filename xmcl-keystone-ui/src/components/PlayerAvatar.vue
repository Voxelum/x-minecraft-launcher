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
import { ref } from 'vue'

const props = withDefaults(
  defineProps<{
    src: string
    dimension: number
  }>(), {
  src: steve,
  dimension: 64,
})

watch(() => props.src, (s) => {
  renderMinecraftPlayerTextHead(s)
}, { immediate: true })

function renderMinecraftPlayerTextHead(textureUrl: string) {
  // Load minecraft player texture from url into canvas
  // We need to also render the head part/overlay of the texture
  const canvas = document.createElement('canvas')
  const ctx = canvas.getContext('2d')
  if (!ctx) return
  const img = new Image()
  img.crossOrigin = 'anonymous'
  img.src = textureUrl
  img.onload = () => {
    // canvas only show head part
    canvas.width = 8
    canvas.height = 8
    // Draw head
    ctx.drawImage(img, 8, 8, 8, 8, 0, 0, 8, 8)
    // Draw front head overlay
    ctx.drawImage(img, 40, 8, 8, 8, 0, 0, 8, 8)
    // Convert canvas to data url
    const dataUrl = canvas.toDataURL()
    // Set the data url to the image
    dataUrlSrc.value = dataUrl
  }
}

const dataUrlSrc = ref('')
</script>

<style></style>
