<template>
  <v-card
    v-ripple
    v-context-menu="contextMenu"
    outlined
    :color="cardColor"
    hoverable
    :disabled="disabled"
    hover
    class="select-none rounded-lg p-4"
    @click="emit('click')"
  >
    <div class="flex">
      <v-img
        max-width="100"
        min-width="100"
        :src="value.icon_url"
        class="hidden rounded-2xl lg:block"
      />
      <div class="ml-3 flex flex-col">
        <div class="flex align-baseline">
          <h2 class="pr-2 text-2xl font-bold">
            {{ value.title }}
          </h2>
          <span class="secondary-text"> by {{ value.author }}</span>
          <div class="flex-grow" />
          <v-icon>
            {{ value.type === 'curseforge' ? '$vuetify.icons.curseforge' :
              value.type === 'ftb' ? '$vuetify.icons.ftb' : '$vuetify.icons.modrinth' }}
          </v-icon>
        </div>
        {{ value.description }}
        <div class="secondary-text mt-1 flex gap-3 align-baseline">
          <span
            v-for="label of value.labels"
            :key="label.text + label.icon"
            class="text-sm"
          >
            <v-icon small>
              {{ label.icon }}
            </v-icon>
            {{ label.text }}
          </span>
        </div>
        <div
          class="mt-2 flex flex-wrap gap-2"
          @click.stop.prevent
        >
          <CategoryChip
            v-for="tag of value.tags"
            :key="tag.text + tag.icon"
            small
            :item="tag"
            @click="emit('filter', tag.text)"
          />
          <!-- <v-chip
            label
            small
          >
            <v-avatar
              v-if="tag.iconHTML"
              left
              v-html="tag.iconHTML"
            />
            <v-avatar
              v-else-if="tag.icon"
              left
            >
              <v-img
                :src="tag.icon"
              />
            </v-avatar>
            {{ tag.text }}
          </v-chip> -->
        </div>
      </div>
    </div>
  </v-card>
</template>
<script lang="ts" setup>
import { ContextMenuItem } from '@/composables/contextMenu'
import { vContextMenu } from '@/directives/contextMenu'
import { injection } from '@/util/inject'
import CategoryChip, { CategoryChipProps } from './CategoryChip.vue'
import { kTheme } from '@/composables/theme'

defineProps<{
  contextMenu?: ContextMenuItem[]
  disabled?: boolean
  value: ExploreProject
}>()

export interface ExploreProject {
  id: string
  type: 'modrinth' | 'curseforge' | 'ftb'
  title: string
  icon_url: string
  description: string
  author: string
  labels: CategoryChipProps[]
  tags: CategoryChipProps[]
  gallery: string[]
}

const emit = defineEmits(['filter', 'click', 'search', 'browse'])

const { cardColor } = injection(kTheme)
</script>
