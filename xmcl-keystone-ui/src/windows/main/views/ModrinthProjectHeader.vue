<template>
  <v-card
    outlined
    class="rounded-lg p-4 flex gap-6"
  >
    <img
      :src="icon"
      class="w-40"
    >
    <div class="flex flex-col gap-2">
      <h2 class="text-2xl font-bold">
        {{ title }}
      </h2>
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
    description: required(String),
    icon: optional(String),
    discordUrl: optional(String),
    issueUrl: optional(String),
    sourceUrl: optional(String),
    wikiUrl: optional(String),
  },
  setup() { },
})
</script>
