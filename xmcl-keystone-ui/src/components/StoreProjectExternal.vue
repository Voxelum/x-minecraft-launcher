<template>
  <div v-if="project.links.length > 0">
    <v-subheader>
      {{ t('modrinth.externalResources') }}
    </v-subheader>
    <div class="my-2 flex w-full flex-1 flex-grow-0 flex-wrap gap-4 px-4">
      <a
        v-for="link of project.links"
        :key="link.url"
        :href="link.url"
        class="flex flex-grow-0 items-center gap-1"
      >
        <v-icon>open_in_new</v-icon> {{ link.name }}
      </a>
    </div>
  </div>
</template>
<script lang="ts" setup>
import { StoreProject } from './StoreProject.vue'

defineProps<{
  project: StoreProject
}>()
const { t } = useI18n()

</script>
