<template>
  <div ref="myRef" />
</template>
<script lang="ts">
import { required } from '../util/props'
import typing from '../util/typing'

const loopedTyping = typing

export default defineComponent({
  props: {
    steps: required<Array<string | number | Function>>(Array),
    wrapper: {
      type: String,
      default: 'div',
    },
    loop: {
      type: Number,
      default: 1,
    },
  },
  setup: ({ steps, loop, wrapper }) => {
    const myRef = ref(null)
    onMounted(() => {
      const dom = myRef.value
      if (dom) {
        if (loop === Infinity) {
          typing(dom, ...steps, loopedTyping)
        } else if (typeof loop === 'number' && loop > 0) {
          typing(dom, ...Array(loop).fill(steps).flat())
        } else {
          typing(dom, ...steps)
        }
      }
    })

    return {
      myRef,
    }
  },
})
</script>
