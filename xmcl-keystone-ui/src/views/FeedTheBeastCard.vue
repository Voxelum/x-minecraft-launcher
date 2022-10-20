<template>
  <v-card
    v-if="manifest"
    v-ripple
    :disabled="refreshing"
    hover
    outlined
    exact
    push
    :to="`/ftb/${id}`"
    class="flex"
  >
    <div
      class="flex items-center justify-center max-w-24 ml-2"
    >
      <v-img
        :src="avatar"
        max-width="100"
        contain
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
    </div>
    <v-divider
      vertical
      style="padding-left: 10px;"
      inset
    />
    <div class="flex-grow">
      <v-card-title>
        <span style="font-weight: bold;">{{ title }}</span>
      </v-card-title>

      <v-card-subtitle class="flex gap-4">
        <a
          v-if="author"
          :href="author.website"
        >by {{ author.name }}</a>
        <div
          v-if="date"
          style="color: grey;"
        >
          {{ getLocalDateString(date * 1000) }}
        </div>
      </v-card-subtitle>
      <v-card-text>{{ description }}</v-card-text>
    </div>
    <div
      class="p-4 flex flex-wrap gap-2"
      @click.stop.prevent
    >
      <v-chip
        v-for="tag of tags"
        :key="tag.id"
        label
        outlined
      >
        {{ tag.name }}
      </v-chip>
    </div>
  </v-card>
  <v-skeleton-loader
    v-else
    class="flex flex-col gap-3 overflow-auto"
    type="list-item-avatar-three-line"
  />
</template>

<script lang=ts setup>
import { useFeedTheBeastProject } from '../composables/ftb'
import { getLocalDateString } from '@/util/date'

const props = defineProps<{ id: number }>()

const { refresh, refreshing, manifest } = useFeedTheBeastProject(computed(() => props.id))
const avatar = computed(() => manifest.value!.art.find(v => v.type === 'square')?.url ?? '')
const title = computed(() => manifest.value?.name ?? '')
const description = computed(() => manifest.value?.synopsis)
const tags = computed(() => manifest.value?.tags || [])
const author = computed(() => manifest.value?.authors[0])
const date = computed(() => manifest.value?.updated)

</script>
