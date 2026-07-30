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

const emit = defineEmits(['model', 'dragover', 'drop', 'error'])

let lastCapeLoad = Promise.resolve()

let viewer: SkinViewer | undefined

let lastLoad = Promise.resolve()
async function loadSkin() {
  const url = props.skin
  const activeViewer = viewer
  if (!url || !activeViewer || data.disposed) return

  console.log('loadSkin', url, props.skin)
  await lastLoad.catch(() => undefined)
  const load = activeViewer.loadSkin(url, {
    model: typeof props.slim === 'undefined' ? 'auto-detect' : props.slim ? 'slim' : 'default',
  })
  lastLoad = load
  try {
    await load
    if (viewer === activeViewer && !data.disposed) {
      emit('model', activeViewer.playerObject.skin.modelType)
    }
  } catch (e) {
    if (e instanceof Error && /^Bad skin size: \d+x\d+$/.test(e.message)) {
      emit('error', 'invalid-skin-size')
      return
    }
    throw e
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
  viewer.renderPaused = props.paused ?? false

  loadSkin()
  if (props.cape) {
    lastCapeLoad = viewer.loadCape(props.cape)
  }
})

watch(animationObject, (v) => {
  if (viewer) viewer.animation = v
})

watch(() => props.skin, loadSkin)
watch(() => props.slim, loadSkin)

watch(() => props.cape, (v) => {
  const activeViewer = viewer
  if (!activeViewer) return
  if (v) {
    lastCapeLoad = lastCapeLoad.finally(() => activeViewer.loadCape(v))
  } else {
    activeViewer.resetCape()
  }
})

watch(() => props.name, (v) => {
  if (viewer) viewer.nameTag = v || 'Steve'
})

watch(() => props.paused, (paused) => {
  if (!viewer) return
  if (paused) {
    viewer.renderPaused = true
  } else {
    viewer.renderPaused = false
  }
})
</script>
