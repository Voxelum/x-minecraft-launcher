<template>
  <canvas
    ref="canvasRef"
    :width="canvasWidth"
    :height="canvasHeight"
    class="player-skin-2d"
    :style="{
      width: `${width}px`,
      height: `${height}px`,
      imageRendering: 'pixelated',
    }"
  />
</template>

<script lang="ts" setup>
import steveSkin from '@/assets/steve_skin.png'

const props = withDefaults(
  defineProps<{
    src?: string
    slim?: boolean
    width?: number
    height?: number
  }>(),
  {
    src: steveSkin,
    slim: false,
    width: 60,
    height: 120,
  },
)

const canvasRef = ref<HTMLCanvasElement | null>(null)

// Exact pixel grid (16x32) at 4x resolution for crystal-clear pixel art
const scale = 4
const canvasWidth = computed(() => (props.slim ? 14 : 16) * scale)
const canvasHeight = computed(() => 32 * scale)

function draw() {
  const canvas = canvasRef.value
  if (!canvas) return
  const ctx = canvas.getContext('2d')
  if (!ctx) return

  ctx.clearRect(0, 0, canvas.width, canvas.height)
  ctx.imageSmoothingEnabled = false

  const img = new Image()
  if (props.src?.startsWith('http://') || props.src?.startsWith('https://')) {
    img.crossOrigin = 'anonymous'
  }
  img.src = props.src || steveSkin

  img.onload = () => {
    ctx.imageSmoothingEnabled = false
    const s = scale
    const armW = props.slim ? 3 : 4

    // Head: 8x8 at (x=4*s, y=0) in 16x32 grid (or 3*s for slim)
    const headX = (props.slim ? 3 : 4) * s
    ctx.drawImage(img, 8, 8, 8, 8, headX, 0, 8 * s, 8 * s)
    ctx.drawImage(img, 40, 8, 8, 8, headX, 0, 8 * s, 8 * s)

    const bodyY = 8 * s
    const bodyH = 12 * s
    const bodyW = 8 * s
    const bodyX = headX

    // Body: 8x12
    ctx.drawImage(img, 20, 20, 8, 12, bodyX, bodyY, bodyW, bodyH)
    if (img.height >= 64) {
      ctx.drawImage(img, 20, 36, 8, 12, bodyX, bodyY, bodyW, bodyH)
    }

    // Right Arm: armW x 12
    const rArmX = bodyX - armW * s
    ctx.drawImage(img, 44, 20, armW, 12, rArmX, bodyY, armW * s, bodyH)
    if (img.height >= 64) {
      ctx.drawImage(img, 44, 36, armW, 12, rArmX, bodyY, armW * s, bodyH)
    }

    // Left Arm: armW x 12
    const lArmX = bodyX + bodyW
    if (img.height >= 64) {
      ctx.drawImage(img, 36, 52, armW, 12, lArmX, bodyY, armW * s, bodyH)
      ctx.drawImage(img, 52, 52, armW, 12, lArmX, bodyY, armW * s, bodyH)
    } else {
      // 1.7 skin mirrored
      ctx.save()
      ctx.scale(-1, 1)
      ctx.drawImage(img, 44, 20, armW, 12, -(lArmX + armW * s), bodyY, armW * s, bodyH)
      ctx.restore()
    }

    // Legs: 4x12
    const legY = bodyY + bodyH
    const legW = 4 * s
    const legH = 12 * s

    // Right Leg
    ctx.drawImage(img, 4, 20, 4, 12, bodyX, legY, legW, legH)
    if (img.height >= 64) {
      ctx.drawImage(img, 4, 36, 4, 12, bodyX, legY, legW, legH)
    }

    // Left Leg
    const lLegX = bodyX + legW
    if (img.height >= 64) {
      ctx.drawImage(img, 20, 52, 4, 12, lLegX, legY, legW, legH)
      ctx.drawImage(img, 4, 52, 4, 12, lLegX, legY, legW, legH)
    } else {
      ctx.save()
      ctx.scale(-1, 1)
      ctx.drawImage(img, 4, 20, 4, 12, -(lLegX + legW), legY, legW, legH)
      ctx.restore()
    }
  }
}

onMounted(draw)
watch(() => [props.src, props.slim, props.width, props.height], draw)
</script>

<style scoped>
.player-skin-2d {
  display: block;
  image-rendering: pixelated;
  image-rendering: -moz-crisp-edges;
  image-rendering: crisp-edges;
}
</style>
