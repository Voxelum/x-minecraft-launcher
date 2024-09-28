<template>
  <div v-if="project.links.length > 0">
    <v-subheader>
      {{ t('modrinth.externalResources') }}
    </v-subheader>
    <div class="my-2 flex w-full flex-1 flex-grow-0 flex-wrap gap-4 px-4">
      <span
        v-for="link of project.links"
        :key="link.url"
        class="flex flex-grow-0 items-center"
      >
        <v-icon left>open_in_new</v-icon>
        <a :href="link.url">
          {{ link.name }}
        </a>
      </span>
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
