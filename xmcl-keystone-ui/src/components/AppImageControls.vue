<template>
  <v-card class="hover:(opacity-100) flex flex-grow-0 gap-2 rounded-xl px-2 py-1 opacity-60 transition">
    <slot name="left"></slot>
    <v-btn
      icon
      small
      @click.stop="onCopy"
    >
      <v-icon v-if="!copied">content_copy</v-icon>
      <v-icon color="green" v-else>check</v-icon>
    </v-btn>
    <slot></slot>
    <v-btn
      icon
      small
      @click.stop="onOpen"
    >
      <v-icon>open_in_new</v-icon>
    </v-btn>
    <slot name="right"></slot>
  </v-card>
</template>

<script lang="ts" setup>
import { useService } from '@/composables'
import { BaseServiceKey } from '@xmcl/runtime-api'

const props = defineProps<{
  image: string
}>()

const { showItemInDirectory } = useService(BaseServiceKey)
const onOpen = () => {
  const value = props.image
  try {
    const url = new URL(value)
    if (url.host === 'launcher') {
      if (url.pathname.startsWith('/media')) {
        const path = url.searchParams.get('path')
        if (path) {
          showItemInDirectory(path)
          return
        }
      }
    }
  } catch {
    return
  }
  window.open(value, 'browser')
}
const copied = ref(false)
const onCopy = () => {
  windowController.writeClipboardImage(props.image)
  copied.value = true
  setTimeout(() => {
    copied.value = false
  }, 2000)
}
</script>
<style>
.image-dialog {
  box-shadow: none;
}
</style>
