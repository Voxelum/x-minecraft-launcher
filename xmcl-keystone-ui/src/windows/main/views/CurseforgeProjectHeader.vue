<template>
  <v-card
    outlined
    class="flex-shrink flex-grow-0 items-center gap-2 z-5 w-full min-w-60"
  >
    <v-img
      class="hidden lg:flex"
      height="250"
      :src="icon"
    >
      <template #placeholder>
        <v-skeleton-loader type="image" />
      </template>
    </v-img>
    <v-card-title>
      <span v-if="!loading">
        {{ name }}
      </span>
      <span v-else>
        <v-skeleton-loader type="heading" />
      </span>
    </v-card-title>
    <v-card-subtitle class="lg:block flex justify-between pb-0">
      <div>
        <v-icon small>
          event
        </v-icon>
        {{ $t("curseforge.createdDate") }}
        <span v-if="!loading">
          {{ new Date(creation).toLocaleDateString() }}
        </span>
        <v-skeleton-loader
          v-else
          type="list-item"
        />
      </div>

      <div>
        <v-icon small>
          event
        </v-icon>
        {{ $t("curseforge.lastUpdate") }}
        <span v-if="!loading">
          {{ new Date(updated).toLocaleDateString() }}
        </span>
        <v-skeleton-loader
          v-else
          type="list-item"
        />
      </div>
      <div>
        <v-icon small>
          file_download
        </v-icon>
        {{ $t("curseforge.totalDownloads") }}
        <span v-if="!loading">
          {{ downloads }}
        </span>
        <v-skeleton-loader
          v-else
          type="list-item"
        />
      </div>
    </v-card-subtitle>
    <v-card-actions>
      <DestMenu
        :value="destination"
        style="flex-grow: 1"
        :from="from"
        @input="$emit('destination', $event)"
      />
    </v-card-actions>
  </v-card>
</template>
<script lang="ts">
import { optional, required } from '/@/util/props'
import DestMenu from './CurseforgeProjectDestMenu.vue'

export default defineComponent({
  components: { DestMenu },
  props: {
    icon: optional(String),
    name: required(String),
    destination: required(String),
    from: required(String),
    creation: required(String),
    updated: required(String),
    downloads: required(Number),
    loading: required(Boolean),
  },
  emits: ['destination'],
})
</script>
