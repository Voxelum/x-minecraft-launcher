<template>
  <v-card
    class="flex flex-col h-full max-h-full"
  >
    <v-img
      :src="news.newsPageImage.url"
    />
    <v-card-title>
      {{ news.title }}
    </v-card-title>
    <v-card-subtitle>
      {{ news.date }}
    </v-card-subtitle>
    <v-card-text class="flex-grow">
      {{ news.text }}
    </v-card-text>
  </v-card>
</template>
<script lang="ts" setup>
import { NewsItem } from '@/composables/mojangNews'

defineProps<{
  news: NewsItem
}>()

</script>
