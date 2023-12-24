<template>
  <v-card
    class="grid h-[360px] max-h-[360px] select-none grid-cols-5 rounded-lg"
    elevation="3"
    @click="$emit('enter')"
  >
    <v-img
      v-if="gallery.images[currentImageIndex]"
      cover
      class="z-2 col-span-3 max-h-[360px] cursor-pointer overflow-hidden rounded-none rounded-l-lg shadow-2xl"
      :src="gallery.images[currentImageIndex][1]"
      :lazy-src="gallery.images[currentImageIndex][0]"
    />
    <div class="col-span-2 flex flex-col pb-2 pr-2">
      <span class="h-18 v-card__title max-w-full overflow-hidden overflow-ellipsis whitespace-nowrap">
        {{ gallery.title }}
      </span>
      <div class="grid grid-cols-1 gap-3 lg:grid-cols-2">
        <v-img
          v-if="gallery.images[0]"
          class="subimage"
          :src="gallery.images[0][1]"
          gradient="to bottom, rgba(0,0,0,.1), rgba(0,0,0,.5)"
          :lazy-src="gallery.images[0][0]"
          @mouseenter="currentImageIndex = 0"
          @click="$emit('enter')"
        />
        <v-img
          v-if="gallery.images[1]"
          class="subimage"
          gradient="to bottom, rgba(0,0,0,.1), rgba(0,0,0,.5)"
          :src="gallery.images[1][1]"
          :lazy-src="gallery.images[1][0]"
          @mouseenter="currentImageIndex = 1"
          @click="$emit('enter')"
        />
        <v-img
          v-if="gallery.images[2]"
          class="subimage hidden lg:block"
          :src="gallery.images[2][1]"
          gradient="to bottom, rgba(0,0,0,.1), rgba(0,0,0,.5)"
          :lazy-src="gallery.images[2][0]"
          @mouseenter="currentImageIndex = 2"
          @click="$emit('enter')"
        />
        <v-img
          v-if="gallery.images[3]"
          class="subimage hidden lg:block"
          :src="gallery.images[3][1]"
          gradient="to bottom, rgba(0,0,0,.1), rgba(0,0,0,.5)"
          :lazy-src="gallery.images[3][0]"
          @mouseenter="currentImageIndex = 3"
          @click="$emit('enter')"
        />
      </div>
      <div class="flex-grow" />
      <div class="ml-2 flex flex-grow-0 select-none gap-1">
        <v-icon class="mr-1">
          {{ gallery.type === 'modrinth' ? '$vuetify.icons.modrinth': '$vuetify.icons.curseforge' }}
        </v-icon>
        <v-chip
          v-for="cat of gallery.categories.slice(0, 3)"
          :key="cat"
          small
          label
          outlined
        >
          {{ cat }}
        </v-chip>
        <span
          v-if="gallery.categories.length > 3"
          v-shared-tooltip="gallery.categories.slice(3, gallery.categories.length).join(' ')"
          class="cursor-default"
        >
          +
        </span>
        <div class="flex-grow" />
        <v-chip
          small
          label
          color="primary"
        >
          {{ gallery.minecraft[0] }}
        </v-chip>
        <span
          v-if="gallery.minecraft.length > 1"
          v-shared-tooltip="gallery.minecraft.slice(1, gallery.minecraft.length).join(', ')"
          class="cursor-default"
        >
          +
        </span>
      </div>
    </div>
  </v-card>
</template>
<script setup lang="ts">
import { vSharedTooltip } from '@/directives/sharedTooltip'

defineProps<{
  gallery: GameGallery
}>()

export interface GameGallery {
  id: string
  title: string
  images: [string, string][]
  developer: string
  categories: string[]
  minecraft: string[]
  type: 'curseforge' | 'modrinth'
}
const currentImageIndex = ref(0)
</script>
<style scoped>
.subimage {
  height: 100px;
  max-height: 100px;
  @apply max-w-[180px] cursor-pointer rounded;
}
</style>
