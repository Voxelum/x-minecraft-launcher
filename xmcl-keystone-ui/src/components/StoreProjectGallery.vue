<template>
  <v-carousel
    :interval="7000"
    :cycle="true"
    :show-arrows="galleries.length > 1"
    hide-delimiter-background
    :hide-delimiters="galleries.length > 9"
  >
    <v-carousel-item
      v-for="(g, i) in galleries"
      :key="i"
      class="cursor-pointer"
      :src="g.url"
      @click="imageDialog.show(g.url, { description: g.description })"
    />
  </v-carousel>
</template>
<script setup lang="ts">
import { injection } from '@/util/inject'
import { StoreProject } from './StoreProject.vue'
import { kImageDialog } from '@/composables/imageDialog'

const props = defineProps<{
  project: StoreProject
}>()

const galleries = computed(() => [...props.project.gallery, { url: props.project.iconUrl ?? '', description: '' }])
const imageDialog = injection(kImageDialog)
</script>
