<template>
  <canvas
    ref="canvasRef"
    @dragover="emit('dragover', $event)"
    @drop="emit('drop', $event)"
  />
</template>

<script lang=ts setup>
import { IdleAnimation, SkinViewer, WalkingAnimation, RunningAnimation } from 'skinview3d'

const props = withDefaults(defineProps<{
  width?: number
  height?: number
  cape?: string
  skin?: string
  slim?: boolean
  name?: string
  animation?: 'walking' | 'none' | 'idle' | 'running'
  paused?: boolean
}>(), {
  width: 210,
  height: 400,
  slim: undefined,
  cape: undefined,
  name: 'Steve',
  skin: '',
  animation: 'idle',
})

const canvasRef = ref(null)
const data = {
  disposed: false,
}
const animationObject = computed(() => {
  if (props.animation === 'none') {
    return null
  }
  if (props.animation === 'walking') {
    return new WalkingAnimation()
  }
  if (props.animation === 'idle') return new IdleAnimation()
  if (props.animation === 'running') return new RunningAnimation()
  return null
})
onUnmounted(() => {
  data.disposed = true
  viewer?.dispose()
})

const emit = defineEmits(['model', 'dragover', 'drop'])

let lastCapeLoad = Promise.resolve()

let viewer: SkinViewer

let lastLoad = Promise.resolve()
async function loadSkin() {
  const url = props.skin
  if (url) {
    console.log('loadSkin', url, props.skin)
    try {
      await lastLoad
    } finally {
      lastLoad = viewer.loadSkin(url, { model: typeof props.slim === 'undefined' ? 'auto-detect' : props.slim ? 'slim' : 'default' }).finally(() => {
        emit('model', viewer.playerObject.skin.modelType)
      })
    }
  }
}

onMounted(() => {
  viewer = new SkinViewer({
    canvas: canvasRef.value!,
    width: props.width,
    height: props.height,
    nameTag: props.name,
    fov: 45,
    zoom: 0.5,
  })

  viewer.animation = animationObject.value

  loadSkin()
  if (props.cape) {
    lastCapeLoad = viewer.loadCape(props.cape)
  }
})

watch(animationObject, (v) => {
  viewer.animation = v
})

watch(() => props.skin, loadSkin)
watch(() => props.slim, loadSkin)

watch(() => props.cape, (v) => {
  if (v) {
    lastCapeLoad = lastCapeLoad.finally(() => viewer.loadCape(v))
  } else {
    viewer.resetCape()
  }
})

watch(() => props.name, (v) => {
  viewer.nameTag = v
})

watch(() => props.paused, (paused) => {
  if (paused) {
    viewer.renderPaused = true
  } else {
    viewer.renderPaused = false
  }
})
</script>
