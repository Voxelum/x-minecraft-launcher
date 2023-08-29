<template>
  <div class="flex h-full max-h-full flex-col overflow-auto">
    <v-card-text
      v-if="refreshing"
      class="overflow-auto"
    >
      <v-skeleton-loader type="heading, list-item, paragraph, card, sentences, image, paragraph, paragraph" />
    </v-card-text>
    <ErrorView
      :error="error"
      @refresh="refresh"
    />
    <v-card-text
      v-if="!refreshing && !error"
      class="overflow-auto"
    >
      <div
        class="overflow-auto"
        v-html="description"
      />
    </v-card-text>
  </div>
</template>

<script lang=ts setup>
import ErrorView from '@/components/ErrorView.vue'
import { useCurseforgeProjectDescription } from '../composables/curseforge'

const props = defineProps<{ project: number }>()
const { refreshing, description, error, refresh } = useCurseforgeProjectDescription(props)

</script>

<style>
.v-image__image {
  background-repeat: no-repeat;
  background-position: center center;
}
</style>
