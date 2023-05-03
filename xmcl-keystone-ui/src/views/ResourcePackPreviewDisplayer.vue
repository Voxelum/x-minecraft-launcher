<template>
  <v-container>
    <canvas
      ref="canvasRef"
      :width="240"
      :height="240"
      @dragover="$emit('dragover', $event)"
      @drop="$emit('drop', $event)"
    />
  </v-container>
</template>

<script lang=ts setup>
import { computed, onMounted, onUnmounted, ref, watch } from 'vue'
import { BlockModelFactory } from '@xmcl/model'
import { BlockModel } from '@xmcl/resourcepack'
import { CachedBlockModel } from '@xmcl/runtime-api'
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls'

import {
  PerspectiveCamera,
  AmbientLight,
  Vector3,
  WebGLRenderer,
  Scene,
} from 'three'

function findRealTexturePath(model: BlockModel.Resolved, variantKey: string) {
  let texturePath = model.textures[variantKey] as string
  while (texturePath.startsWith('#')) {
    const next = model.textures[texturePath.substring(1, texturePath.length)]
    if (!next) {
      console.log(`Find NOOP ${variantKey}`)
      return undefined
    }
    texturePath = next
  }
  console.log(`Find ${texturePath} ${variantKey}`)
  return texturePath
}

const props = defineProps<{ value: CachedBlockModel }>()
const canvasRef = ref(null)
const data = {
  disposed: false,
}

onMounted(() => {
  if (canvasRef.value) {
    const renderer = new WebGLRenderer({ canvas: canvasRef.value!, antialias: true, alpha: true })
    const scene = new Scene()
    const camera = new PerspectiveCamera(60, 1, 1, 1000)
    const controls = new OrbitControls(camera, canvasRef.value!)

    camera.position.x = 16 / 1.5
    camera.position.y = 24 / 1.5
    camera.position.z = 32 / 1.5

    scene.add(new AmbientLight(0xffffff, 0.97))

    camera.lookAt(new Vector3(0, 0, 0))

    controls.target = new Vector3(0, 0, 0)
    controls.enableDamping = true
    controls.dampingFactor = 0.2
    controls.zoomSpeed = 1.4
    controls.rotateSpeed = 0.6
    controls.autoRotate = true
    controls.autoRotateSpeed = 12

    function updateObject() {
      for (const [key, value] of Object.entries(props.value.model.textures)) {
        // eslint-disable-next-line vue/no-mutating-props
        props.value.model.textures[key] = findRealTexturePath(props.value.model, key)
      }
      // TODO: fix this
      // const obj = new BlockModelFactory(props.value.textures).getObject(props.value.model)

      // if (currentObj) {
      //   scene.remove(currentObj)
      // }
      // scene.add(obj)
      // currentObj = obj
      // obj.position.y += 2
    }

    let currentObj: any
    watch(computed(() => props.value), () => {
      updateObject()
    })
    updateObject()

    requestAnimationFrame(function animate(nowMsec) {
      if (data.disposed) return
      requestAnimationFrame(animate)
      const result = controls.update()
      renderer.render(scene, camera)
    })
  } else {
    console.error('WTF')
  }
})

onUnmounted(() => {
  data.disposed = true
})

</script>
