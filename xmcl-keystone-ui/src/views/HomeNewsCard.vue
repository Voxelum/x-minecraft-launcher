<template>
  <v-hover v-slot="{ hover }">
    <v-card
      dark
      class="h-full"
      @click="nav"
    >
      <v-img
        class="h-full"
        :src="news.playPageImage.url"
      >
        <div
          class="container"
          :class="{ 'on-hover': hover }"
        >
          <v-card-title>
            {{ news.title }}
          </v-card-title>
          <v-card-subtitle>
            {{ new Date(news.date).toLocaleDateString() }}
          </v-card-subtitle>
          <v-card-text
            class="flex-grow"
          >
            {{ news.text }}
          </v-card-text>
          <!-- <v-card-text>
            <v-btn
              text
              flat
              color="primary"
              :href="news.readMoreLink"
            >
              {{ t('news.readMore') }}
            </v-btn>
          </v-card-text> -->
        </div>
      </v-img>
    </v-card>
  </v-hover>
</template>
<script lang="ts" setup>
import { NewsItem } from '@/composables/mojangNews'

const props = defineProps<{
  news: NewsItem
}>()

const { t } = useI18n()

const nav = () => {
  window.location.href = props.news.readMoreLink
}

</script>

<style scoped>
.container {
  @apply transition-colors ;
}

.container {
  height: 100%;
  background-color: rgba(0, 0, 0, 0.0);
}

.container.on-hover {
  background-color: rgba(0, 0, 0, 0.5) !important;
}

</style>
