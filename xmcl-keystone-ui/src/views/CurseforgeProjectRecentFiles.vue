<template>
  <v-card
    outlined
    class="max-h-full overflow-auto flex flex-col md:hidden lg:flex"
  >
    <v-card-title class="text-md font-bold">
      {{ t("curseforge.recentFiles") }}
    </v-card-title>
    <v-divider />
    <v-skeleton-loader
      v-if="!files"
      type="list-item-avatar-three-line, list-item-avatar-three-line, list-item-avatar-three-line, list-item-avatar-three-line, list-item-avatar-three-line"
    />
    <v-list
      v-else
      class="overflow-auto"
    >
      <v-tooltip
        v-for="file in files"
        :key="file.id"
        top
      >
        <template #activator="{ on }">
          <v-list-item
            :v-ripple="!isDownloaded(file) "
            v-on="on"
          >
            <v-list-item-content>
              <v-list-item-title>
                {{
                  file.displayName
                }}
              </v-list-item-title>
              <v-list-item-subtitle>
                {{
                  getLocalDateString(file.fileDate)
                }}
              </v-list-item-subtitle>
            </v-list-item-content>
            <v-list-item-action>
              <v-btn
                text
                icon
                :loading="getDownloadProgress(file) !== -1"
                @click="install(file)"
              >
                <v-icon>
                  {{
                    isDownloaded(file)
                      ? "add"
                      : "download"
                  }}
                </v-icon>
                <template #loader>
                  <v-progress-circular
                    :value="getDownloadProgress(file)"
                    :size="24"
                    :width="2"
                  />
                </template>
              </v-btn>
            </v-list-item-action>
          </v-list-item>
        </template>
        {{ file.fileName }}
      </v-tooltip>
    </v-list>
  </v-card>
</template>

<script lang=ts setup>
import { useCurseforgeInstall } from '@/composables/curseforgeInstall'
import { kTaskManager } from '@/composables/taskManager'
import { getLocalDateString } from '@/util/date'
import { injection } from '@/util/inject'
import { File } from '@xmcl/curseforge'
import { ProjectType, TaskState } from '@xmcl/runtime-api'

const props = defineProps<{
  files?: File[]
  from: string
  type: ProjectType
}>()

const { t } = useI18n()
const { install, isDownloaded } = useCurseforgeInstall(computed(() => props.files ?? []), computed(() => props.from), props.type)
const taskManager = injection(kTaskManager)

const getDownloadProgress = (file: File) => {
  const task = taskManager.tasks.value.find(v => v.state === TaskState.Running && v.path === 'installCurseforgeFile' && v.param.fileId === file.id)
  if (task) {
    return task.progress / task.total * 100
  }
  return -1
}
</script>
