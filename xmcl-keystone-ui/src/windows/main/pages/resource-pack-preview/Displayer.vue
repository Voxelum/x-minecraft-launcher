<template>
  <v-container>
    <canvas
      ref="canvas"
      :width="400"
      :height="400"
      @dragover="$emit('dragover', $event)"
      @drop="$emit('drop', $event)"
    />
  </v-container>
</template>

<script lang=ts>
import { computed, defineComponent, onMounted, onUnmounted, ref, watch } from '@vue/composition-api'
import { BlockModelFactory } from '@xmcl/model'
import { BlockModel } from '@xmcl/resourcepack'
import { PerspectiveCamera } from 'three/src/cameras/PerspectiveCamera'
import { AmbientLight } from 'three/src/lights/AmbientLight'
import { Vector3 } from 'three/src/math/Vector3'
import { WebGLRenderer } from 'three/src/renderers/WebGLRenderer'
import { Scene } from 'three/src/scenes/Scene'
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls'
import { required } from '/@/util/props'

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

export default defineComponent({
  props: {
    value: required<{
      model: BlockModel.Resolved
      textures: Record<string, { url: string }>
    }>(Object),
  },
  setup(props) {
    const canvas = ref(null)
    const data = {
      disposed: false,
    }
    onUnmounted(() => {
      data.disposed = true
    })
    onMounted(() => {
      const renderer = new WebGLRenderer({ canvas: canvas.value!, antialias: true, alpha: true })
      const scene = new Scene()
      const camera = new PerspectiveCamera(60, 1, 1, 1000)
      const controls = new OrbitControls(camera, canvas.value!)

      camera.position.x = 16
      camera.position.x = 16
      camera.position.x = 32

      scene.add(new AmbientLight(0xffffff, 0.97))

      camera.lookAt(new Vector3(0, 0, 0))

      controls.target = new Vector3(0, 0, 0)
      controls.enableDamping = true
      controls.dampingFactor = 0.2
      controls.zoomSpeed = 1.4
      controls.rotateSpeed = 0.6
      controls.enableKeys = false
      // if (props.rotate) {
      //   controls.autoRotate = true;
      //   controls.autoRotateSpeed = 4;
      // } else {
      controls.autoRotate = false
      // }

      let currentObj: any
      watch(computed(() => props.value), () => {
        for (const [key, value] of Object.entries(props.value.model.textures)) {
          // eslint-disable-next-line vue/no-mutating-props
          props.value.model.textures[key] = findRealTexturePath(props.value.model, key)
        }
        const obj = new BlockModelFactory(props.value.textures).getObject(props.value.model)

        if (currentObj) {
          scene.remove(currentObj)
        }
        scene.add(obj)
        currentObj = obj
      })

      requestAnimationFrame(function animate(nowMsec) {
        if (data.disposed) return
        requestAnimationFrame(animate)
        const result = controls.update()
        renderer.render(scene, camera)
      })
    })

    return {
      canvas,
    }
  },
})
</script>
