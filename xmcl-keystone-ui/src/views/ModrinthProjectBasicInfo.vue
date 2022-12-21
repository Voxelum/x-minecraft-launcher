<template>
  <div class="flex flex-col gap-2 items-start">
    <span class="text-gray-400 grid grid-cols-2 w-full gap-x-1 gap-y-2">
      <span>
        <v-icon
          class="material-icons-outlined"
          left
        >
          file_download
        </v-icon>
        <span>{{ t('modrinth.downloads') }}</span>
        <span class="text-2xl font-bold dark:text-gray-300 text-gray-600">
          {{ getExpectedSize(project.downloads, '') }}
        </span>
      </span>
      <span>
        <v-icon
          class="material-icons-outlined text-gray-300 mb-2 mr-2"
        >
          star_rate
        </v-icon>
        <span>{{ t('modrinth.followers') }}</span>
        <span class="text-2xl font-bold dark:text-gray-300 text-gray-600">
          {{ project.followers }}
        </span>
      </span>
      <span class="flex gap-1 flex-grow-0">
        <v-icon
          class="material-icons-outlined text-gray-300"
          left
        >
          event
        </v-icon>
        <span>{{ t('modrinth.createAt') }}</span>
        {{ getLocalDateString(project.published) }}
      </span>
      <span class="flex gap-1 flex-grow-0">
        <v-icon
          class="material-icons-outlined text-gray-300"
          left
        >
          update
        </v-icon>
        <span>{{ t('modrinth.updateAt') }}</span>
        {{ getLocalDateString(project.updated) }}
      </span>
    </span>
  </div>
</template>
<script lang="ts" setup>
import { getLocalDateString } from '@/util/date'
import { getExpectedSize } from '@/util/size'
import { Project } from '@xmcl/modrinth'

defineProps<{
  project: Project
}>()
const { t } = useI18n()

</script>
<style scoped>
</style>
