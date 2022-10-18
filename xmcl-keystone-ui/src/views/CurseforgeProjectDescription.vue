<template>
  <div class="h-full flex overflow-auto flex-col max-h-full">
    <v-card-text
      v-if="!loading"
      class="overflow-auto"
    >
      <div
        ref="descriptionRef"
        class="overflow-auto"
        v-html="description"
      />
    </v-card-text>
    <v-card-text
      v-else
      class="overflow-auto"
    >
      <v-skeleton-loader type="heading, list-item, paragraph, card, sentences, image, paragraph, paragraph" />
    </v-card-text>
  </div>
</template>

<script lang=ts setup>
import { useCurseforgeProjectDescription } from '../composables/curseforge'

const props = defineProps<{ project: number }>()
const { loading, description } = useCurseforgeProjectDescription(props.project)
const descriptionRef = ref(null as null | HTMLElement)

watch(loading, (v) => {
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
