<template>
  <v-card class="rounded-b-xl">
    <div
      class="p-4 markdown-body"
      v-html="htmlContent"
    />
  </v-card>
</template>
<script lang="ts">
import { required } from '/@/util/props'
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
<style>
.markdown-body li, .markdown-body p {
    padding: 0 !important;
    line-height: 1.5 !important;
    word-wrap: break-word !important;
    word-wrap: anywhere !important;
}
.markdown-body blockquote, .markdown-body code, .markdown-body details, .markdown-body dl, .markdown-body ol, .markdown-body p, .markdown-body pre, .markdown-body table, .markdown-body ul {
    margin-top: 0 !important;
    margin-bottom: 16px !important;
}
</style>
