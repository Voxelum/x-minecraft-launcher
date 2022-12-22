<template>
  <div>
    <div
      :key="version.id"
      class="dark:text-gray-300 text-gray-700 grid grid-cols-13 mt-3 mb-1"
    >
      <div class="flex justify-center">
        <v-btn
          v-if="!isDownloaded(version)"
          icon
          text
          :loading="installingVersion || relatedTasks[version.id]"
          :disabled="isDownloaded(version)"
          @click.stop="onInstall(version)"
        >
          <template #loader>
            <v-progress-circular
              :size="24"
              :width="3"
              :indeterminate="installingVersion && !relatedTasks[version.id]"
              :value="relatedTasks[version.id] ? (relatedTasks[version.id].progress / relatedTasks[version.id].total * 100) : undefined"
            />
          </template>
          <v-icon class="material-icons-outlined">
            file_download
          </v-icon>
        </v-btn>
        <v-btn
          v-else
          icon
          text
          @click.stop="onInstall(version)"
        >
          <v-icon> add </v-icon>
        </v-btn>
      </div>
      <div class="col-span-4">
        <div>
          {{ version.name }}
        </div>
        <div class="mt-1">
          <span
            :style="{ color: getColorCode(getColorForReleaseType(version.version_type)),borderColor: getColorCode(getColorForReleaseType(version.version_type)) }"
            class="font-bold border-l border-l-[3px] pl-3"
          >
            {{ t(`versionType.${version.version_type}`) }}
          </span>
          ·
          {{ version.version_number }}
        </div>
      </div>
      <div class="col-span-4">
        <div>
          {{ version.loaders.join(', ') }}
        </div>
        <div class="mt-1">
          {{ version.game_versions.join(', ') }}
        </div>
      </div>
      <div class="col-span-4">
        <div>
          {{ t('downloadCount', { count: version.downloads }) }}
        </div>
        <div class="mt-1">
          {{ getLocalDateString(version.date_published) }}
        </div>
      </div>
    </div>
    <div
      v-if="version.changelog"
      :key="`${version.id}-changelog`"
      class="grid grid-cols-13 my-1.5"
    >
      <div class="col-span-1" />
      <div
        colspan="3"
        :style="{ borderColor: getColorCode(getColorForReleaseType(version.version_type)) }"
        class="border-l border-l-[3px] pl-3 col-span-12"
      >
        <div
          class="text-gray-500 hover:text-black dark:hover:text-gray-300 text-gray-500 transition-colors"
          v-html="render(version.changelog)"
        />
      </div>
    </div>
  </div>
</template>
<script lang="ts" setup>
import { useVuetifyColor } from '@/composables/vuetify'
import type { ProjectVersion } from '@xmcl/modrinth'
import Markdown from 'markdown-it'
import { getLocalDateString } from '@/util/date'
import { getColorForReleaseType } from '@/util/color'
import { TaskItem } from '@/entities/task'
import { useServiceBusy } from '@/composables'
import { ModrinthServiceKey } from '@xmcl/runtime-api'

const props = defineProps<{
  source: ProjectVersion
  relatedTasks: Record<string, TaskItem>
  isDownloaded(version: ProjectVersion): boolean
  onInstall(version: ProjectVersion): void
}>()

const version = computed(() => props.source)
const { getColorCode } = useVuetifyColor()
const { t } = useI18n()
const markdown = new Markdown({
  html: true,
})
const installingVersion = useServiceBusy(ModrinthServiceKey, 'installVersion', computed(() => props.source.id))
const render = (s: string) => {
  return markdown.render(s)
}

</script>
