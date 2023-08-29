<template>
  <v-card
    v-ripple
    v-context-menu="contextMenuItems"
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
        :src="value.icon_url"
        class="rounded-2xl"
      />
      <div class="ml-3 flex flex-col">
        <div class="flex align-baseline">
          <h2 class="pr-2 text-2xl font-bold">
            {{ value.title }}
          </h2>
          <span class="secondary-text"> by {{ value.author }}</span>
        </div>
        {{ value.description }}
        <div class="secondary-text mt-1 flex gap-3 align-baseline">
          <span class="text-sm">
            <v-icon small>
              file_download
            </v-icon>
            {{ value.downloads }}
          </span>
          <span class="text-sm">
            <v-icon small>
              event
            </v-icon>
            {{ getLocalDateString(value.date_created) }}
          </span>
          <span class="text-sm">
            <v-icon small>
              edit
            </v-icon>
            {{ getLocalDateString(value.date_modified) }}
          </span>
          <span class="text-sm">
            <v-icon small>
              local_offer
            </v-icon>
            {{ value.versions[value.versions.length - 1] }}
          </span>
        </div>
        <div
          class="mt-2 flex flex-wrap gap-2"
          @click.stop.prevent
        >
          <v-chip
            v-for="tag in items"
            :key="tag.name"
            label
            small
            @click="emit('filter', tag.name)"
          >
            <v-avatar
              left
              v-html="tag.icon"
            />
            {{ t(`modrinth.categories.${tag.name}`, tag.name) }}
          </v-chip>
        </div>
      </div>
    </div>
  </v-card>
</template>
<script lang="ts" setup>
import type { Category, SearchResultHit } from '@xmcl/modrinth'
import { ModrinthCategoriesKey } from '../composables/modrinth'

import { ContextMenuItem } from '@/composables/contextMenu'
import { vContextMenu } from '@/directives/contextMenu'
import { getLocalDateString } from '@/util/date'
import { injection } from '@/util/inject'
import { kColorTheme } from '@/composables/colorTheme'

const props = defineProps<{
  disabled: boolean
  value: SearchResultHit
}>()

const emit = defineEmits(['filter', 'click', 'search', 'browse'])
const { t } = useI18n()

const { cardColor } = injection(kColorTheme)
const cates = injection(ModrinthCategoriesKey)
const items = computed(() => {
  return props.value.categories.map(c => cates.value.find(cat => cat.name === c)).filter((c): c is Category => !!c)
})

const contextMenuItems = computed(() => {
  const items: ContextMenuItem[] = [{
    text: t('modrinth.quickSearch', { title: props.value.title }),
    onClick() { emit('search') },
    icon: 'search',
  }, {
    text: t('modrinth.copyTitle', { title: props.value.title }),
    onClick() {
      navigator.clipboard.writeText(props.value.title)
    },
    icon: 'content_paste',
  }, {
    text: t('modrinth.browseUrl', { url: `https://modrinth.com/${props.value.project_type}/${props.value.slug}` }),
    onClick() {
      window.open(`https://modrinth.com/${props.value.project_type}/${props.value.slug}`, 'browser')
    },
    icon: 'open_in_new',
  }]
  return items
})

</script>
