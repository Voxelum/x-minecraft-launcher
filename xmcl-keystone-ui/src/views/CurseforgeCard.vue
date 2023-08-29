<template>
  <v-card
    v-ripple
    v-context-menu="items"
    :disabled="disabled"
    hover
    outlined
    exact
    push
    :to="`/curseforge/${currentType}/${proj.id}?from=${from || ''}`"
    class="flex select-none"
  >
    <v-img
      :src="proj.logo.url"
      max-width="120"
      class="rounded"
    >
      <template #placeholder>
        <v-layout
          fill-height
          align-center
          justify-center
          ma-0
        >
          <v-progress-circular
            indeterminate
            color="grey lighten-5"
          />
        </v-layout>
      </template>
    </v-img>
    <div class="flex-grow">
      <v-card-title>
        {{ proj.name }}
      </v-card-title>
      <v-card-subtitle class="flex flex-wrap gap-4">
        <div class="text-current">
          <v-icon
            left
            small
          >
            person
          </v-icon>
          {{ proj.authors[0].name }}
        </div>
        <div>
          <v-icon
            left
            small
          >
            event
          </v-icon>
          {{ getLocalDateString(proj.dateModified || proj.dateCreated) }}
        </div>
        <div>
          <v-icon
            left
            small
          >
            file_download
          </v-icon>
          {{ getExpectedSize(proj.downloadCount, '') }}
        </div>
      </v-card-subtitle>
      <v-card-text>{{ proj.summary }}</v-card-text>
    </div>
    <div
      class="flex flex-grow-0 flex-wrap content-start justify-end gap-2 p-4"
      @click.stop.prevent
    >
      <v-chip
        v-for="cat of dedup(proj.categories, (v) => v.id)"
        :key="cat.id"
        label
        outlined
        @click.stop.prevent="emit('category', cat.id)"
      >
        <v-tooltip top>
          <template #activator="{ on }">
            <v-avatar>
              <img
                :src="cat.iconUrl"
                style="max-height:30px; max-width: 30px"
                v-on="on"
              >
            </v-avatar>
          </template>
          {{ cat.name }}
        </v-tooltip>
      </v-chip>
    </div>
  </v-card>
</template>

<script lang=ts setup>
import { Mod } from '@xmcl/curseforge'

import { getLocalDateString } from '@/util/date'
import { dedup } from '@/util/dedup'
import { getExpectedSize } from '@/util/size'
import { ContextMenuItem } from '@/composables/contextMenu'
import { vContextMenu } from '@/directives/contextMenu'

const props = defineProps<{
  proj: Mod
  disabled: boolean
  currentType: string
  from?: string
}>()

const emit = defineEmits(['category', 'search'])
const { t } = useI18n()

const items = computed(() => {
  const items: ContextMenuItem[] = [{
    text: t('modrinth.quickSearch', { title: props.proj.name }),
    onClick() { emit('search', props.proj.name) },
    icon: 'search',
  }, {
    text: t('modrinth.copyTitle', { title: props.proj.name }),
    onClick() {
      navigator.clipboard.writeText(props.proj.name)
    },
    icon: 'content_paste',
  }, {
    text: t('modrinth.browseUrl', { url: `https://beta.curseforge.com/minecraft/${props.currentType}/${props.proj.slug}` }),
    onClick() {
      window.open(`https://beta.curseforge.com/minecraft/${props.currentType}/${props.proj.slug}`, 'browser')
    },
    icon: 'open_in_new',
  }]
  return items
})

</script>
