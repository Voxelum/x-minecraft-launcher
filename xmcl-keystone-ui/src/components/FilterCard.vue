<template>
  <v-card class="rounded-xl w-full">
    <v-card-title>
      <div class="flex items-center gap-2">
        <span class="font-bold text-sm uppercase text-gray-700 dark:text-gray-300">
          {{ title }}
        </span>
        <span v-if="selectedCount" class="v-badge__badge primary static">
          {{ selectedCount }}
        </span>
        <v-spacer />
        <v-btn
          v-if="selectedCount > 0"
          icon
          color="error"
          small
          @click="emit('clear')"
        >
          <v-icon>close</v-icon>
        </v-btn>
      </div>
    </v-card-title>
    <v-card-text>
      <div class="grid grid-cols-4 lg:(grid-cols-2) gap-2 pt-2">
        <div
          v-for="item in items"
          :key="item.id"
          v-shared-tooltip="item.text"
          class="flex items-center gap-2 p-2 rounded-lg cursor-pointer transition hover:bg-gray-200 dark:hover:bg-white/10"
          :class="isSelected(item.id) ? 'bg-gray-100 dark:bg-white/8 text-gray-900 dark:text-white' : 'text-gray-600 dark:text-gray-400'"
          @click="emit('toggle', item.id)"
        >
            <div v-if="item.iconHTML" v-html="item.iconHTML" class="max-w-5 h-5 flex items-center justify-center [&>svg]:w-full [&>svg]:h-full"></div>
            <img v-else-if="item.icon" :src="item.icon" class="w-5 h-5 object-contain" />
            <span class="text-xs font-medium truncate">{{ item.text }}</span>
        </div>
      </div>
    </v-card-text>
  </v-card>
</template>

<script lang="ts" setup>
import { vSharedTooltip } from '@/directives/sharedTooltip'

export interface FilterItem {
  id: string
  text: string
  iconHTML?: string
  icon?: string
}

const props = defineProps<{
  title: string
  items: FilterItem[]
  selected: string[]
  selectedCount: number
}>()

const emit = defineEmits<{
  (e: 'toggle', id: string): void
  (e: 'clear'): void
}>()

const isSelected = (id: string) => {
  return props.selected.includes(id)
}
</script>