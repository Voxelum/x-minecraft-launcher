<template>
  <div
    class="rounded-xl"
    style="overflow: hidden"
    :style="{
      'max-width': `${80}px`,
      'max-height': `${120}px`,
      'min-height': `${120}px`,
      'min-width': `${80}px`,
    }"
  >
    <img
      ref="image"
      :src="src || steve"
      style="image-rendering: pixelated; border-radius: 0"
      :style="style"
      @load="onload"
    />
  </div>
</template>

<script lang="ts">
import { defineComponent, reactive, ref, toRefs, computed, Ref } from 'vue'
import steve from '@/assets/steve_skin.png'

export default defineComponent({
  props: {
    src: {
      type: String,
      default: steve,
    },
  },
  setup(props) {
    const data = reactive({
      steve,
      textureWidth: 0,
      textureHeight: 0,
    })
    const image: Ref<any> = ref(null)

    const style = computed(() => ({
      'transform-origin': '0 0',
      transform: 'scale(8) translate(-1px, -1px)',
    }))

    function onload() {
      const el = image.value
      if (!el) return
      data.textureWidth = el.naturalWidth
      data.textureHeight = el.naturalHeight
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

<style></style>
