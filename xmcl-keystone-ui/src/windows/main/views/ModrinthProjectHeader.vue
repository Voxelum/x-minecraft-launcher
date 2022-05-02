<template>
  <v-card
    outlined
    class="rounded-lg p-4 flex gap-6"
  >
    <v-img
      :src="icon"
      width="200"
      class="rounded-lg"
    />
    <div class="flex flex-col gap-2">
      <a class="text-2xl font-bold" target="_blank" :href="`https://modrinth.com/modpack/${slug}`">
        {{ title }}
      </a>
      <span class="text-lg">{{ description }}</span>
      <span class="flex gap-4">
        <a
          v-if="discordUrl"
          :href="discordUrl"
          class="flex items-center gap-1 flex-grow-0"
        >
          <v-icon>open_in_new</v-icon>Discord
        </a>
        <a
          v-if="issueUrl"
          :href="issueUrl"
          class="flex items-center gap-1 flex-grow-0"
        >
          <v-icon>open_in_new</v-icon>Issue
        </a>
        <a
          v-if="sourceUrl"
          :href="sourceUrl"
          class="flex items-center gap-1 flex-grow-0"
        >
          <v-icon>open_in_new</v-icon>Source
        </a>
        <a
          v-if="wikiUrl"
          :href="wikiUrl"
          class="flex items-center gap-1 flex-grow-0"
        >
          <v-icon>open_in_new</v-icon>Wiki
        </a>
      </span>
    </div>
  </v-card>
</template>
<script lang="ts">
import { optional, required } from '/@/util/props'

export default defineComponent({
  props: {
    title: required(String),
    projectType: required(String),
    description: required(String),
    slug: required(String),
    icon: optional(String),
    discordUrl: optional(String),
    issueUrl: optional(String),
    sourceUrl: optional(String),
    wikiUrl: optional(String),
  },
  setup() { },
})
</script>
