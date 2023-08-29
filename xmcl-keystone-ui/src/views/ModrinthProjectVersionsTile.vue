<template>
  <div>
    <div
      :key="version.id"
      class="grid-cols-13 mb-1 mt-3 grid text-gray-700 dark:text-gray-300"
    >
      <div class="flex justify-center">
        <v-btn
          icon
          text
          :loading="installingVersion || tasks[version.id]"
          :disabled="isSameFileWithUpstream"
          @click.stop="onInstall()"
        >
          <template #loader>
            <v-progress-circular
              :size="24"
              :width="3"
              :indeterminate="installingVersion && !tasks[version.id]"
              :value="tasks[version.id] ? (tasks[version.id].progress / tasks[version.id].total * 100) : undefined"
            />
          </template>
          <v-icon class="material-icons-outlined">
            {{ icon }}
          </v-icon>
        </v-btn>
      </div>
      <div class="col-span-4">
        <div>
          {{ version.name }}
        </div>
        <div class="mt-1">
          <span
            :style="{ color: getColorCode(getColorForReleaseType(version.version_type)),borderColor: getColorCode(getColorForReleaseType(version.version_type)) }"
            class="border-l-[3px] pl-3 font-bold"
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
      class="grid-cols-13 my-1.5 grid"
    >
      <div class="col-span-1" />
      <div
        colspan="3"
        :style="{ borderColor: getColorCode(getColorForReleaseType(version.version_type)) }"
        class="col-span-12 border-l-[3px] pl-3"
      >
        <div
          class="text-gray-500 transition-colors hover:text-black dark:hover:text-gray-300"
          v-html="render(version.changelog)"
        />
      </div>
    </div>
  </div>
</template>
<script lang="ts" setup>
import { useVuetifyColor } from '@/composables/vuetify'
import type { ProjectVersion } from '@xmcl/modrinth'
import { getLocalDateString } from '@/util/date'
import { getColorForReleaseType } from '@/util/color'
import { useServiceBusy } from '@/composables'
import { ModrinthServiceKey } from '@xmcl/runtime-api'
import { kModrinthVersionsStatus } from '@/composables/modrinthVersions'
import { injection } from '@/util/inject'
import { kUpstream } from '@/composables/instanceUpdate'
import { useMarkdown } from '@/composables/markdown'

const props = defineProps<{
  source: ProjectVersion
}>()

const emit = defineEmits(['install'])

const version = computed(() => props.source)
const { getColorCode } = useVuetifyColor()
const { t } = useI18n()
const { render } = useMarkdown()

const { isDownloaded, tasks } = injection(kModrinthVersionsStatus)
const _upstream = inject(kUpstream, undefined)
const upstreamVersion = computed(() => {
  return _upstream?.value.upstream?.type === 'modrinth-modpack' ? _upstream.value.upstream.versionId : ''
})
const onInstall = () => emit('install', props.source)

const isVersionDownloaded = computed(() => isDownloaded(props.source))
const isSameFileWithUpstream = computed(() => upstreamVersion.value === props.source.id)
const icon = computed(() => {
  if (upstreamVersion.value) {
    return isVersionDownloaded.value ? 'upgrade' : 'file_download'
  } else {
    return isVersionDownloaded.value ? 'add' : 'file_download'
  }
})

const installingVersion = useServiceBusy(ModrinthServiceKey, 'installVersion', computed(() => props.source.id))

</script>
