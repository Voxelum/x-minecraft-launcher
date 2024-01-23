<template>
  <div
    class="flex min-h-[100vh] flex-col gap-2 object-contain"
    :style="{ opacity }"
  >
    <img
      :src="news.newsPageImage.url"
      class="min-h-[100vh] object-cover"
    >
    <div class="img-container" />
  </div>
</template>
<script setup lang="ts">
import { kColorTheme } from '@/composables/colorTheme'
import { NewsItem } from '@/composables/mojangNews'
import { injection } from '@/util/inject'

const { sideBarColor } = injection(kColorTheme)
defineProps<{
  news: NewsItem
  opacity?: number
}>()
</script>
<style scoped>
.img-container {
  background: radial-gradient(ellipse at top right, #1a1a1a00, v-bind(sideBarColor) 72%);
  position: absolute;
  min-width: 100%;
  min-height: 100%;
}
</style>
