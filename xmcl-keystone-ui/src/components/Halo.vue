<template>
  <div ref="halo" class="h-full w-full z-0 absolute bg-transparent" style="filter: blur(10px);"></div>
</template>

<script lang="ts">
import { defineComponent, onMounted, ref } from '@vue/composition-api'
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