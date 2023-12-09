<template>
  <HomeDefault
    v-if="!isFocus"
  />
  <HomeFocus v-else />
</template>
<script lang="ts" setup>
import { useInFocusMode } from '@/composables/uiLayout'
import HomeDefault from './HomeDefault.vue'
import HomeFocus from './HomeFocus.vue'

const isFocus = useInFocusMode()
</script>
