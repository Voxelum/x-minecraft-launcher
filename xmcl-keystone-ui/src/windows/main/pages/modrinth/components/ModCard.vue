<template>
  <v-card
    outlined
    :disabled="disabled"
    class="rounded-lg shadow p-4"
    @click="$emit('click')"
  >
    <div class="flex">
      <img
        :src="value.icon_url"
        class="w-[100px] rounded"
      >
      <div class="flex flex-col ml-3">
        <div class="flex align-baseline">
          <h2 class="text-2xl font-bold pr-2">
            {{ value.title }}
          </h2>
          <span> by {{ value.author }}</span>
        </div>
        {{ value.description }}
        <div class="flex align-baseline gap-3">
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
            {{ new Date(value.date_created).toLocaleString() }}
          </span>
          <span>
            <v-icon small>
              edit
            </v-icon>
            {{ new Date(value.date_modified).toLocaleDateString() }}
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
            v-for="tag in value.categories"
            :key="tag"
            label
            small
            @click="$emit('filter', tag)"
          >
            {{ $t(`modrinth.categories.${tag}`) }}
          </v-chip>
        </div>
      </div>
    </div>
  </v-card>
</template>
<script lang="ts">
import { defineComponent } from '@vue/composition-api'
import type { SearchResultHit } from '@xmcl/modrinth'
import { required } from '/@/util/props'

export default defineComponent({
  props: {
    disabled: required(Boolean),
    value: required<SearchResultHit>(Object),
  },
  setup() { },
})
</script>
