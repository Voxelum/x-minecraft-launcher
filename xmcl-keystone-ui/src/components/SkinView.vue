<template>
  <canvas
    ref="canvasRef"
    @dragover="$emit('dragover', $event)"
    @drop="$emit('drop', $event)"
  />
</template>

<script lang=ts setup>
import { IdleAnimation, SkinViewer, WalkingAnimation, RunningAnimation } from 'skinview3d'
import steveSkin from '/@/assets/steve_skin.png'

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
  slim: false,
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

let lastLoad = Promise.resolve()

onMounted(() => {
  const viewer = new SkinViewer({
    canvas: canvasRef.value!,
    width: props.width,
    height: props.height,
    cape: props.cape,
    nameTag: props.name,
    fov: 45,
    zoom: 0.5,
  })
  viewer.animation = animationObject.value

  watch(animationObject, (v) => {
    viewer.animation = v
  })

  lastLoad = viewer.loadSkin(props.skin || steveSkin)

  watch(() => props.skin, (v) => {
    lastLoad = lastLoad.then(() => {
      return viewer.loadSkin(v || steveSkin, { model: props.slim ? 'slim' : 'default' })
    })
  })

  watch(() => props.cape, (v) => {
    if (v) {
      viewer.loadCape(v)
    } else {
      viewer.resetCape()
    }
  })

  watch(() => props.slim, (v) => {
    viewer.loadSkin(props.skin || steveSkin, { model: v ? 'slim' : 'default' })
  })

  watch(() => props.name, (v) => {
    viewer.nameTag = v
  })

  // const renderer = new WebGLRenderer({ canvas: canvas.value!, antialias: true, alpha: true })
  // const scene = new Scene()
  // const camera = new PerspectiveCamera(45, props.width / props.height, 0.5, 5)
  // const controls = new OrbitControls(camera, canvas.value!)

  // camera.position.z = 3
  // camera.lookAt(new Vector3(0, 0, 0))

  // controls.target = new Vector3(0, 0, 0)
  // controls.enablePan = false
  // // controls.enableKeys = false
  // controls.maxDistance = props.maxDistance
  // controls.minDistance = props.minDistance
  // if (props.rotate) {
  //   controls.autoRotate = true
  //   controls.autoRotateSpeed = 4
  // } else {
  //   controls.autoRotate = false
  // }

  // scene.add(model)

  // requestAnimationFrame(function animate(nowMsec) {
  //   if (data.disposed) return
  //   requestAnimationFrame(animate)
  //   const result = controls.update()
  //   renderer.render(scene, camera)
  // })
})
</script>
