<template>
  <div
    ref="el"
    class="group relative bg-surface rounded-2xl overflow-hidden transition-all duration-300 hover:shadow-xl hover:-translate-y-2 border border-white/5 flex flex-col h-full cursor-pointer z-1"
    @click="$emit('click')"
  >
    <!-- Image Area -->
    <div class="aspect-[16/9] relative rounded-2xl overflow-hidden z-1">
      <transition name="fade-transition" mode="out-in">
        <img
          :key="imgSrc"
          :src="imgSrc"
          class="w-full h-full object-cover transition-transform duration-700 group-hover:scale-110 z-0"
          loading="lazy"
        />
      </transition>
      <div class="absolute inset-0 bg-gradient-to-t from-black/80 to-transparent opacity-60 group-hover:opacity-0 transition-opacity"></div>

      <div class="absolute top-3 right-3 flex gap-2">
        <v-chip x-small class="bg-black/60 dark:bg-white/60 text-white dark:text-black backdrop-blur-md font-bold uppercase tracking-wider text-3">
          {{ value.type }}
        </v-chip>
      </div>

    </div>

    <!-- Content Area -->
    <div class="p-4 flex flex-col flex-1 gap-2">
      <div class="flex items-start gap-3">
        <img :src="value.iconUrl" class="w-10 h-10 rounded-lg object-cover bg-surface-variant shadow-sm border border-white/10" />
        <div class="overflow-hidden">
          <h3 class="font-bold text-base leading-tight truncate text-gray-900 dark:text-white group-hover:text-primary transition-colors" v-shared-tooltip="value.localizedTitle || value.title">
            {{ value.localizedTitle || value.title }}
          </h3>
          <p class="text-xs text-gray-600 dark:text-gray-500 mt-0.5 truncate">{{ value.author }}</p>
        </div>
      </div>

      <p 
        class="text-xs text-gray-700 dark:text-gray-400 line-clamp-2 h-9 leading-relaxed"
        v-shared-tooltip.bottom="value.localizedDescription || value.description"
      >{{ value.localizedDescription || value.description }}</p>

      <div class="mt-auto pt-2 border-t border-white/5 text-3 text-gray-600 dark:text-gray-500 font-medium">
        <div class="grid grid-cols-2 gap-2">
          <div class="flex items-center gap-1.5">
            <v-icon x-small color="grey">file_download</v-icon>
            {{ value.downloadCount }}
          </div>
          <div class="flex items-center gap-1.5">
            <v-icon x-small color="grey">event</v-icon>
            {{ value.updatedAt }}
          </div>
        </div>
        <div v-if="value.version" class="flex justify-end mt-2">
          <v-chip x-small outlined color="grey" class="px-1.5">
            {{ value.version }}
          </v-chip>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { vSharedTooltip } from '@/directives/sharedTooltip';
import { useElementHover, useInterval } from '@vueuse/core';

const props = defineProps<{ value: ExploreProjectModern }>()

const el = ref<HTMLElement | null>(null)
const hover = useElementHover(el)
const { pause, reset, resume, counter } = useInterval(2000, { controls: true, immediate: false })

watch(hover, (isHovering) => {
  if (isHovering) {
    resume()
  } else {
    pause()
    reset()
  }
})

const imgSrc = computed(() => {
  if (props.value.gallery && props.value.gallery.length > 0) {
    return props.value.gallery[counter.value % props.value.gallery.length]
  }
  return props.value.iconUrl
})

export interface ExploreProjectModern {
  id: string
  type: 'modrinth' | 'curseforge' | 'ftb'
  title: string
  iconUrl: string
  description: string
  author: string
  downloadCount: string
  updatedAt: string
  version?: string
  gallery?: string[]
  localizedTitle?: string
  localizedDescription?: string
}
</script>
