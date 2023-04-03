<template>
  <div
    class="p-4 markdown-body"
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
    const htmlContent = computed(() => render(props.description))
    return {
      htmlContent,
    }
  },
})
</script>
