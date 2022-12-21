<template>
  <div
    class="p-4 markdown-body"
    v-html="htmlContent"
  />
</template>
<script lang="ts">
import { required } from '@/util/props'
import Markdown from 'markdown-it'

const md = Markdown({
  typographer: true,
  html: true,
  linkify: true,
})

export default defineComponent({
  props: {
    description: required(String),
  },
  setup(props) {
    const htmlContent = computed(() => md.render(props.description))
    return {
      htmlContent,
    }
  },
})
</script>
