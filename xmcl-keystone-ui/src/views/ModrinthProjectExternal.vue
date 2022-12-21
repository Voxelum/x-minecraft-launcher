<template>
  <div>
    <v-subheader>
      {{ t('modrinth.externalResources') }}
    </v-subheader>
    <div class="flex gap-1 flex-1 flex-grow-0 w-full px-4 h-[48px]">
      <a
        v-if="project.discord_url"
        :href="project.discord_url"
        class="flex items-center gap-1 flex-grow-0"
      >
        <v-icon>open_in_new</v-icon>Discord
      </a>
      <a
        v-if="project.issues_url"
        :href="project.issues_url"
        class="flex items-center gap-1 flex-grow-0"
      >
        <v-icon>open_in_new</v-icon>Issue
      </a>
      <a
        v-if="project.source_url"
        :href="project.source_url"
        class="flex items-center gap-1 flex-grow-0"
      >
        <v-icon>open_in_new</v-icon>Source
      </a>
      <a
        v-if="project.wiki_url"
        :href="project.wiki_url"
        class="flex items-center gap-1 flex-grow-0"
      >
        <v-icon>open_in_new</v-icon>Wiki
      </a>
    </div>
  </div>
</template>
<script lang="ts" setup>
import { Project } from '@xmcl/modrinth'

defineProps<{
  project: Project
}>()
const { t } = useI18n()

</script>
<style scoped>
a:not(:last-child):after {
    content: "•";
    margin: 0 0.25rem;
}
</style>
