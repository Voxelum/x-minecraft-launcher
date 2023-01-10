<template>
  <v-card
    class="flex flex-col h-full"
  >
    <div>
      <v-img
        :src="news.playPageImage.url"
        contain
        :max-height="200"
      />
    </div>
    <div class="flex-grow flex flex-col h-full">
      <v-card-title>
        {{ news.title }}
      </v-card-title>
      <v-card-subtitle>
        {{ new Date(news.date).toLocaleDateString() }}
      </v-card-subtitle>
      <v-card-text class="flex-grow">
        {{ news.text }}
      </v-card-text>
      <v-card-text>
        <v-btn
          tile
          color="primary"
          :href="news.readMoreLink"
        >
          {{ t('news.readMore') }}
        </v-btn>
      </v-card-text>
    </div>
  </v-card>
</template>
<script lang="ts" setup>
import { NewsItem } from '@/composables/mojangNews'

defineProps<{
  news: NewsItem
}>()

const { t } = useI18n()

</script>
