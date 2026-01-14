<template>
  <div
    class="group relative bg-surface rounded-2xl overflow-hidden transition-all duration-300 hover:shadow-xl hover:-translate-y-2 border border-white/5 flex flex-col h-full cursor-pointer z-1"
    @click="$emit('click')"
  >
    <!-- Image Area -->
    <div class="aspect-[16/9] relative rounded-2xl overflow-hidden bg-black/20 z-1">
      <img
        :src="value.gallery[0] || value.icon_url"
        class="w-full h-full object-cover transition-transform duration-700 group-hover:scale-110 z-0"
        loading="lazy"
      />
      <div class="absolute inset-0 bg-gradient-to-t from-black/80 to-transparent opacity-60 group-hover:opacity-40 transition-opacity"></div>

      <div class="absolute top-3 right-3 flex gap-2">
        <v-chip x-small class="bg-black/60 dark:bg-white/60 text-white dark:text-black backdrop-blur-md font-bold uppercase tracking-wider text-3">
          {{ value.type }}
        </v-chip>
      </div>

      <div class="absolute bottom-0 left-0 right-0 p-4 transform translate-y-2 opacity-0 group-hover:translate-y-0 group-hover:opacity-100 transition-all duration-300 flex justify-between items-center">
        <span class="text-xs font-bold text-gray-900 dark:text-white bg-primary px-2 py-1 rounded-md shadow-lg">INSTALL</span>
      </div>
    </div>

    <!-- Content Area -->
    <div class="p-4 flex flex-col flex-1 gap-2">
      <div class="flex items-start gap-3">
        <img :src="value.icon_url" class="w-10 h-10 rounded-lg object-cover bg-surface-variant shadow-sm border border-white/10" />
        <div class="overflow-hidden">
          <h3 class="font-bold text-base leading-tight truncate text-gray-900 dark:text-white group-hover:text-primary transition-colors" v-shared-tooltip="value.title">
            {{ value.title }}
          </h3>
          <p class="text-xs text-gray-600 dark:text-gray-500 mt-0.5 truncate">{{ value.author }}</p>
        </div>
      </div>

      <p class="text-xs text-gray-700 dark:text-gray-400 line-clamp-2 h-9 leading-relaxed">{{ value.description }}</p>

      <div class="mt-auto pt-2 border-t border-white/5 flex items-center justify-between text-3 text-gray-600 dark:text-gray-500 font-medium">
        <div class="flex items-center gap-1.5" >
          <v-icon x-small color="grey">file_download</v-icon>
          {{ value.labels.find(l => l.icon === 'file_download')?.text }}
        </div>
        <div class="flex items-center gap-1.5" >
          <v-icon x-small color="grey">event</v-icon>
          {{ value.labels.find(l => l.icon === 'event')?.text }}
        </div>
        <div v-if="value.labels.find(l => l.icon === 'local_offer')" class="flex items-center gap-1.5">
          <v-chip x-small outlined color="grey" class="px-1.5">
            {{ value.labels.find(l => l.icon === 'local_offer')?.text }}
          </v-chip>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ExploreProject } from '@/components/StoreExploreCard.vue'
import { vSharedTooltip } from '@/directives/sharedTooltip';
defineProps<{ value: ExploreProject }>()
</script>