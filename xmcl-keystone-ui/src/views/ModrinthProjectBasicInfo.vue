<template>
  <div class="flex flex-col items-start gap-2">
    <span class="grid w-full grid-cols-2 gap-x-1 gap-y-2 text-gray-400">
      <span>
        <v-icon
          class="material-icons-outlined"
          left
        >
          file_download
        </v-icon>
        <span>{{ t('modrinth.downloads') }}</span>
        <span class="text-2xl font-bold text-gray-600 dark:text-gray-300">
          {{ getExpectedSize(project.downloads, '') }}
        </span>
      </span>
      <span class="">
        <v-icon
          class="material-icons-outlined mb-2 mr-2 text-gray-300"
        >
          star_rate
        </v-icon>
        <span>{{ t('modrinth.followers') }}</span>
        <span class="text-2xl font-bold text-gray-600 dark:text-gray-300">
          {{ project.followers }}
        </span>
      </span>
      <span class="">
        <v-icon
          class="material-icons-outlined text-gray-300"
          left
        >
          event
        </v-icon>
        <span>{{ t('modrinth.createAt') }}</span>
        {{ getLocalDateString(project.published) }}
      </span>
      <span class="">
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
