<template>
  <div
    style="overflow: hidden"
    :style="{ 'max-width': `${dimension}px`, 'max-height': `${dimension}px`, 'min-height': `${dimension}px`, 'min-width': `${dimension}px` }"
  >
    <img
      ref="image"
      :src="src || steve"
      :width="textureWidth"
      :height="textureHeight"
      style="image-rendering: pixelated; border-radius: 0"
      :style="style"
      @load="onload"
    >
  </div>
</template>

<script lang=ts>
import { defineComponent, reactive, ref, toRefs, computed, Ref } from 'vue'
import steve from '@/assets/steve_skin.png'

export default defineComponent({
  props: {
    src: {
      type: String,
      default: steve,
    },
    dimension: {
      type: Number,
      default: 64,
    },
  },
  setup(props) {
    const data = reactive({
      steve,
      textureWidth: 0,
      textureHeight: 0,
    })
    const image: Ref<any> = ref(null)

    const translateX = computed(() => -props.dimension / 8)
    const translateY = computed(() => -props.dimension / 8)

    const style = computed(() => ({
      'transform-origin': '0 0',
      transform: `scale(8) translate(${translateX.value}px, ${translateY.value}px)`,
      'min-width': data.textureWidth,
      'min-height': data.textureHeight,
    }))

    function onload() {
      data.textureWidth = image.value.naturalWidth
      data.textureHeight = image.value.naturalHeight
    }
    return {
      ...toRefs(data),
      style,
      image,
      onload,
    }
  },
})
</script>

<style>
</style>
