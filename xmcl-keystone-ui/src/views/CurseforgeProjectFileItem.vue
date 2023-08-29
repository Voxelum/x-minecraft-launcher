<template>
  <v-list-item>
    <v-list-item-content>
      <v-list-item-title :title="name">
        {{
          name
        }}
      </v-list-item-title>
      <v-list-item-subtitle class="divide divide-gray-400">
        <span>
          <span
            class="border-l-width-[2px] border-l pl-1"
            :style="{ color: getColorForReleaseType(releaseType), ['border-color']: getColorForReleaseType(releaseType) }"
          >
            {{
              releases[releaseType]
            }}
          </span>
          <span
            v-if="loader"
            class="px-1"
          >
            {{
              loader
            }}
          </span>
          <template v-if="versions">
            <span
              v-for="v of versions"
              :key="v"
              class="px-1"
            >
              {{
                v
              }}
            </span>
          </template>
          <span
            v-if="size"
            class="px-1"
          >
            {{
              getExpectedSize(size)
            }}
          </span>
        </span>
        <span
          v-if="date"
          class="float-right"
        >
          {{ getLocalDateString(date) }}
        </span>
      </v-list-item-subtitle>
    </v-list-item-content>
    <v-list-item-action v-if="icon">
      <v-btn
        text
        icon
        :disabled="isSameFileWithUpstream"
        :loading="progress !== -1"
        @click="emit('install')"
      >
        <v-icon class="material-icons-outlined">
          {{
            icon
          }}
        </v-icon>
        <template #loader>
          <v-progress-circular
            :value="progress"
            :size="24"
            :width="2"
          />
        </template>
      </v-btn>
    </v-list-item-action>
  </v-list-item>
</template>

<script lang=ts setup>
import { kCurseforgeInstall } from '@/composables/curseforgeInstall'
import { kTaskManager } from '@/composables/taskManager'
import { vSharedTooltip } from '@/directives/sharedTooltip'
import { getColorForReleaseType } from '@/util/color'
import { getLocalDateString } from '@/util/date'
import { injection } from '@/util/inject'
import { getExpectedSize } from '@/util/size'
import { TaskState } from '@xmcl/runtime-api'

const props = defineProps<{
  id: number
  modId: number
  name: string
  loader?: string
  disabled?: boolean
  releaseType: number
  versions?: string[]
  upstreamFileId?: number
  size?: number
  date?: string
}>()
// const tooltip = useSharedTooltip<boolean>((v) => v ? t('curseforge.install') : t('curseforge.downloadOnly'))

const { t } = useI18n()
const releases = computed(() => ['', t('versionType.release'), 'Beta', 'Alpha'])
const emit = defineEmits(['install'])

const taskManager = injection(kTaskManager)
const { isDownloaded } = injection(kCurseforgeInstall)
const isFileDownloaded = computed(() => isDownloaded({ id: props.id, modId: props.modId }))
const isSameFileWithUpstream = computed(() => props.upstreamFileId === props.id)
const icon = computed(() => {
  if (props.upstreamFileId) {
    return isFileDownloaded.value ? 'upgrade' : 'file_download'
  } else {
    return isFileDownloaded.value ? 'add' : 'file_download'
  }
})

const progress = computed(() => {
  const task = taskManager.tasks.value.find(v => v.state === TaskState.Running && v.path === 'installCurseforgeFile' && v.param.fileId === props.id)
  if (task) {
    return task.progress / task.total * 100
  }
  return -1
})
</script>
