<template>
  <canvas
    ref="canvasRef"
    @dragover="emit('dragover', $event)"
    @drop="emit('drop', $event)"
  />
</template>

<script lang=ts setup>
import { IdleAnimation, SkinViewer, WalkingAnimation, RunningAnimation } from 'skinview3d'
import steveSkin from '@/assets/steve_skin.png'

const props = withDefaults(defineProps<{
  width?: number
  height?: number
  cape?: string
  skin?: string
  slim?: boolean
  name?: string
  animation?: 'walking' | 'none' | 'idle' | 'running'
}>(), {
  width: 210,
  height: 400,
  slim: undefined,
  cape: undefined,
  name: 'Steve',
  skin: steveSkin,
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
})

const emit = defineEmits(['model', 'dragover', 'drop'])

let lastLoad = Promise.resolve()
let lastCapeLoad = Promise.resolve()

onMounted(() => {
  const viewer = new SkinViewer({
    canvas: canvasRef.value!,
    width: props.width,
    height: props.height,
    nameTag: props.name,
    fov: 45,
    zoom: 0.5,
  })
  viewer.animation = animationObject.value

  watch(animationObject, (v) => {
    viewer.animation = v
  })

  lastLoad = viewer.loadSkin(props.skin || steveSkin, { model: typeof props.slim === 'undefined' ? 'auto-detect' : props.slim ? 'slim' : 'default' }).finally(() => {
    emit('model', viewer.playerObject.skin.modelType)
  })
  if (props.cape) {
    lastCapeLoad = viewer.loadCape(props.cape)
  }

  watch(() => props.skin, (v) => {
    lastLoad = lastLoad.finally(() => {
      return viewer.loadSkin(v || steveSkin, { model: typeof props.slim === 'undefined' ? 'auto-detect' : props.slim ? 'slim' : 'default' }).finally(() => {
        emit('model', viewer.playerObject.skin.modelType)
      })
    })
  })

  watch(() => props.cape, (v) => {
    if (v) {
      lastCapeLoad = lastCapeLoad.finally(() => viewer.loadCape(v))
    } else {
      viewer.resetCape()
    }
  })

  watch(() => props.slim, (v) => {
    viewer.loadSkin(props.skin || steveSkin, { model: typeof v === 'undefined' ? 'auto-detect' : v ? 'slim' : 'default' }).finally(() => {
      emit('model', viewer.playerObject.skin.modelType)
    })
  })

  watch(() => props.name, (v) => {
    viewer.nameTag = v
  })
})
</script>
