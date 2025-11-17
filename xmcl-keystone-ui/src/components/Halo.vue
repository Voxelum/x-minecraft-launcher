<template>
  <div
    ref="halo"
    style="filter: blur(10px);"
  />
</template>

<script lang="ts">
import { defineComponent, onMounted, ref } from 'vue'
import {
  Camera, Color, LinearFilter, Mesh,
  PlaneGeometry, RGBAFormat, Scene,
  ShaderMaterial,
  TextureLoader, Vector2, Vector3, WebGLRenderer, WebGLRenderTarget,
} from 'three'

// TODO: fix this after refactor halo
// TODO: verify RGBAFormat vs RGBFormat
window.THREE = {
  LinearFilter,
  WebGLRenderTarget,
  RGBFormat: RGBAFormat,
  RGBAFormat,
  Vector3,
  Color,
  Vector2,
  WebGLRenderer,
  Scene,
  ShaderMaterial,
  TextureLoader,
  Mesh,
  PlaneGeometry,
  Camera,
} as any

// @ts-ignore
// eslint-disable-next-line import/first
import initHalo from './halo'

export default defineComponent({
  emits: ['error'],
  setup(props, { emit }) {
    const halo = ref(null as any)
    onMounted(() => {
      try {
        const vantaEffect = initHalo({
          el: halo.value,
          THREE: window.THREE,
        })
        
        // Check if the effect was successfully initialized
        if (!vantaEffect) {
          console.error('Failed to initialize Halo effect: initHalo returned null')
          emit('error', new Error('Halo initialization failed'))
          return
        }
        
        // Check if WebGL context was successfully created
        if (vantaEffect.renderer) {
          const gl = vantaEffect.renderer.getContext()
          if (!gl || gl.isContextLost()) {
            console.error('WebGL context lost or unavailable for Halo effect')
            emit('error', new Error('WebGL context unavailable'))
            if (vantaEffect.destroy) {
              vantaEffect.destroy()
            }
          }
        } else {
          console.error('Halo effect renderer not initialized')
          emit('error', new Error('WebGL renderer unavailable'))
          if (vantaEffect.destroy) {
            vantaEffect.destroy()
          }
        }
      } catch (error) {
        console.error('Failed to initialize Halo effect:', error)
        emit('error', error)
      }
    })
    return { halo }
  },
})

</script>
