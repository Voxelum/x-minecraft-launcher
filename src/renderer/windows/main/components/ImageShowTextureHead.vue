<template>
  <div style="overflow: hidden" 
       :style="{ 'max-width': `${dimension}px`, 'max-height': `${dimension}px`, 'min-height': `${dimension}px`, 'min-width': `${dimension}px` }">
    <img ref="image" 
         :src="src || steve"
         :width="textureWidth"
         :height="textureHeight"
         style="image-rendering: pixelated; border-radius: 0" 
         :style="style"
         @load="onload">
  </div>
</template>

<script>
import steve from 'renderer/assets/steve_skin.png';

export default {
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
  data() {
    return {
      steve,
      textureWidth: 0,
      textureHeight: 0,
    };
  },
  computed: {
    style() {
      return {
        'transform-origin': '0 0',
        transform: `scale(8) translate(${this.translateX}px, ${this.translateY}px)`,
        'min-width': this.textureWidth,
        'min-height': this.textureHeight,
      };
    },
    translateX() {
      return -this.dimension / 8;
    },
    translateY() {
      return -this.dimension / 8;
    },
  },
  created() {
  },
  methods: {
    onload() {
      this.textureWidth = this.$refs.image.naturalWidth;
      this.textureHeight = this.$refs.image.naturalHeight;
    },
  },
};
</script>

<style>
</style>
