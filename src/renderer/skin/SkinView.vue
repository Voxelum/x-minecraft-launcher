<template>
  <div>
    <canvas
      ref="canvas"
      :width="width"
      :height="height"
      @dragover="$emit('dragover', $event)"
      @drop="$emit('drop', $event)"
    />
  </div>
</template>

<script lang=ts>
import { reactive, onUnmounted, watch, toRefs, ref, onMounted, defineComponent, Ref, computed } from '@vue/composition-api'
import { PlayerModel, PlayerObject3D } from '@xmcl/model'
import steveSkin from '/@/assets/steve_skin.png'
import { WebGLRenderer } from 'three/src/renderers/WebGLRenderer'
import { Scene } from 'three/src/scenes/Scene'
import { PerspectiveCamera } from 'three/src/cameras/PerspectiveCamera'
import { Vector3 } from 'three/src/math/Vector3'
import { Object3D } from 'three/src/core/Object3D'
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls'
import { MeshBasicMaterial } from 'three/src/materials/MeshBasicMaterial'
import { DoubleSide, NearestFilter, Texture } from 'three'

function useSkinModel(url: Ref<string>, slim: Ref<boolean>) {
  // const model = PlayerModel.create()
  const skinImage = new Image(64, 64)
  const capeImage = new Image()
  const texture = new Texture(skinImage, undefined, undefined, undefined, NearestFilter, NearestFilter)
  const capeTexture = new Texture(capeImage)

  skinImage.onload = () => {
    texture.needsUpdate = true
  }
  capeImage.onload = () => {
    capeTexture.needsUpdate = true
  }

  watch([url, slim], () => {
    skinImage.src = url.value
    model.slim = slim.value
  })

  const model = new PlayerObject3D(
    new MeshBasicMaterial({ map: texture }),
    new MeshBasicMaterial({ map: capeTexture }),
    new MeshBasicMaterial({
      map: texture,
      transparent: true,
      depthWrite: true,
      side: DoubleSide,
    }),
    slim.value)

  model.translateY(-0.5)

  // watch([url, slim], () => {
  //   img.value!.src = url.value
  // })

  return { model }
}

export default defineComponent({
  props: {
    width: {
      type: Number,
      default: 210,
    },
    height: {
      type: Number,
      default: 400,
    },
    cape: {
      type: Object,
      required: false,
      default: null,
    },
    rotate: {
      type: Boolean,
      default: true,
    },
    maxDistance: {
      type: Number,
      default: 3,
    },
    minDistance: {
      type: Number,
      default: 1.5,
    },
    slim: {
      type: Boolean,
      default: false,
    },
    href: {
      type: String,
      required: true,
      default: null,
    },
  },
  setup(props) {
    const canvas = ref(null)
    const data = {
      disposed: false,
    }
    const src = computed(() => props.href || steveSkin)
    const { model } = useSkinModel(src, computed(() => props.slim))
    onUnmounted(() => {
      data.disposed = true
    })
    onMounted(() => {
      const renderer = new WebGLRenderer({ canvas: canvas.value!, antialias: true, alpha: true })
      const scene = new Scene()
      const camera = new PerspectiveCamera(45, props.width / props.height, 0.5, 5)
      const controls = new OrbitControls(camera, canvas.value!)

      camera.position.z = 3
      camera.lookAt(new Vector3(0, 0, 0))

      controls.target = new Vector3(0, 0, 0)
      controls.enablePan = false
      controls.enableKeys = false
      controls.maxDistance = props.maxDistance
      controls.minDistance = props.minDistance
      if (props.rotate) {
        controls.autoRotate = true
        controls.autoRotateSpeed = 4
      } else {
        controls.autoRotate = false
      }

      scene.add(model)

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
