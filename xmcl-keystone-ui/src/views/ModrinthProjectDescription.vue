<template>
  <div
    class="markdown-body p-4"
    v-html="htmlContent"
  />
</template>
<script lang="ts">
import { useMarkdown } from '@/composables/markdown'
import { required } from '@/util/props'

const { render } = useMarkdown()

export default defineComponent({
  props: {
    description: required(String),
  },
  setup(props) {
    const htmlContent = computed(() => render(props.description).replace(/font-size:[ 0-9]*px/g, ''))
    return {
      htmlContent,
    }
  },
})
</script>
