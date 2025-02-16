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
import { injection } from '@/util/inject'
import { kCompact } from '@/composables/scrollTop'

const isFocus = useInFocusMode()
const compact = injection(kCompact)
onMounted(() => {
  compact.value = false
})
</script>
