<template>
  <div
    ref="halo"
    style="filter: blur(10px);"
  />
</template>

<script lang="ts">
import { defineComponent, onMounted, ref, watch } from 'vue'
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
// eslint-disable-next-line import/first
import { injection } from '@/util/inject'
// eslint-disable-next-line import/first
import { kTheme } from '@/composables/theme'

export default defineComponent({
  setup() {
    const halo = ref(null as any)
    const { isDark } = injection(kTheme)
    onMounted(() => {
      const effect = initHalo({
        el: halo.value,
        THREE: window.THREE,
        lightTheme: isDark.value ? 0 : 1,
      })
      watch(isDark, (dark) => {
        effect?.setOptions?.({ lightTheme: dark ? 0 : 1 })
      })
    })
    return { halo }
  },
})

</script>
