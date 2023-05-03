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
  setup: (props) => {
    const myRef = ref(null)
    onMounted(() => {
      const dom = myRef.value
      if (dom) {
        if (props.loop === Infinity) {
          typing(dom, ...props.steps, loopedTyping)
        } else if (typeof props.loop === 'number' && props.loop > 0) {
          typing(dom, ...Array(props.loop).fill(props.steps).flat())
        } else {
          typing(dom, ...props.steps)
        }
      }
    })

    return {
      myRef,
    }
  },
})
</script>
