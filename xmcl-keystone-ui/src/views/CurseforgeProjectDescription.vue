<template>
  <div class="h-full flex overflow-auto flex-col max-h-full">
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
        ref="descriptionRef"
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
const descriptionRef = ref(null as null | HTMLElement)

watch(refreshing, (v) => {
  if (!v) {
    nextTick().then(() => {
      const root = descriptionRef.value
      if (root) {
        const allLinks = root.getElementsByTagName('a')
        for (const link of allLinks) {
          if (link.href) {
            const parsed = new URL(link.href)
            const remoteUrl = parsed.searchParams.get('remoteUrl')
            if (remoteUrl) {
              link.href = decodeURIComponent(remoteUrl)
            }
          }
        }
      }
    })
  }
})

</script>

<style>
.v-image__image {
  background-repeat: no-repeat;
  background-position: center center;
}
</style>
