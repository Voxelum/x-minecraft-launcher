<template>
  <v-card
    v-ripple
    outlined
    :disabled="disabled"
    hover
    class="rounded-lg p-4"
    @click="emit('click')"
  >
    <div class="flex">
      <v-img
        max-width="100"
        :src="value.icon_url"
        class="rounded-2xl"
      />
      <div class="flex flex-col ml-3">
        <div class="flex align-baseline">
          <h2 class="text-2xl font-bold pr-2">
            {{ value.title }}
          </h2>
          <span class="secondary-text"> by {{ value.author }}</span>
        </div>
        {{ value.description }}
        <div class="flex align-baseline gap-3 secondary-text">
          <span>
            <v-icon small>
              file_download
            </v-icon>
            {{ value.downloads }}
          </span>
          <span>
            <v-icon small>
              event
            </v-icon>
            {{ getLocalDateString(value.date_created) }}
          </span>
          <span>
            <v-icon small>
              edit
            </v-icon>
            {{ getLocalDateString(value.date_modified) }}
          </span>
          <span>
            <v-icon small>
              local_offer
            </v-icon>
            {{ value.versions[value.versions.length - 1] }}
          </span>
        </div>
        <div
          tags
          class="flex gap-2 mt-2"
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
            {{ t(`modrinth.categories.${tag.name}`) }}
          </v-chip>
        </div>
      </div>
    </div>
  </v-card>
</template>
<script lang="ts" setup>
import type { Category, SearchResultHit } from '@xmcl/modrinth'
import { ModrinthCategoriesKey } from '../composables/modrinth'
import { useI18n } from '/@/composables'
import { getLocalDateString } from '/@/util/date'
import { injection } from '/@/util/inject'

const props = defineProps<{
  disabled: boolean
  value: SearchResultHit
}>()

const emit = defineEmits(['filter', 'click'])
const { t } = useI18n()

const cates = injection(ModrinthCategoriesKey)
const items = computed(() => {
  return props.value.categories.map(c => cates.value.find(cat => cat.name === c)).filter((c): c is Category => !!c)
})

</script>
