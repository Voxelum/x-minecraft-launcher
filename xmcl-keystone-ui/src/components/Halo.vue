<template>
  <div
    ref="halo"
    class="h-full w-full z-0 absolute bg-transparent"
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
window.THREE = {
  LinearFilter,
  WebGLRenderTarget,
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
  setup() {
    const halo = ref(null as any)
    onMounted(() => {
      initHalo({
        el: halo.value,
        THREE: window.THREE,
      })
    })
    return { halo }
  },
})

</script>
