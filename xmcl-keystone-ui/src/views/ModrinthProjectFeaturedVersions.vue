<template>
  <div class="">
    <v-subheader>
      {{ t('modrinth.featuredVersions') }}
    </v-subheader>
    <ErrorView
      :error="error"
      @refresh="refresh"
    />
    <v-list>
      <v-list-item
        v-for="version of featured"
        :key="version.id"
        @click="onClick(version)"
      >
        <v-list-item-avatar>
          <v-progress-circular
            v-if="relatedTasks[version.id]"
            :size="24"
            :width="3"
            :value="relatedTasks[version.id].progress / relatedTasks[version.id].total * 100"
          />
          <v-icon
            v-else
            class="material-icons-outlined"
          >
            {{ isDownloaded(version) ? 'add' : 'file_download' }}
          </v-icon>
        </v-list-item-avatar>
        <v-list-item-content>
          <v-list-item-title v-text="version.name" />
          <v-list-item-subtitle>
            <div>
              {{ version.loaders.join(' ') }}
              {{ version.game_versions.length === 1 ? version.game_versions[0] : version.game_versions[0] + '-' + version.game_versions[version.game_versions.length - 1] }}
            </div>
            <span
              :style="{ color: getColorCode(getColorForReleaseType(version.version_type)) }"
            >
              •
              {{ t(`versionType.${version.version_type}`) }}
            </span>
          </v-list-item-subtitle>
        </v-list-item-content>
      </v-list-item>
    </v-list>
  </div>
</template>
<script lang="ts" setup>
import ErrorView from '@/components/ErrorView.vue'
import { useModrinthVersions, useModrinthVersionsStatus } from '@/composables/modrinthVersions'
import { kTaskManager } from '@/composables/taskManager'
import { useVuetifyColor } from '@/composables/vuetify'
import { TaskItem } from '@/entities/task'
import { getColorForReleaseType } from '@/util/color'
import { injection } from '@/util/inject'
import { Project, ProjectVersion } from '@xmcl/modrinth'
import { TaskState } from '@xmcl/runtime-api'
const props = defineProps<{
  project: Project
  installTo: string
}>()

const { t } = useI18n()

const { getColorCode } = useVuetifyColor()
const emit = defineEmits(['install'])

const { versions, refreshing, error, refresh } = useModrinthVersions(computed(() => props.project.id), true)
const { isDownloaded } = useModrinthVersionsStatus(versions)

const featured = computed(() => {
  return versions.value
})
onMounted(refresh)

const { tasks } = injection(kTaskManager)
const relatedTasks = computed(() => {
  const all = tasks.value.filter(t => t.state === TaskState.Running && t.path === 'installModrinthFile' && t.param.projectId === props.project.id)
  const dict = {} as Record<string, TaskItem>
  for (const t of all) {
    dict[t.param.versionId] = t
  }
  return dict
})

const onClick = (version: ProjectVersion) => {
  if (relatedTasks.value[version.id]) return
  emit('install', version)
}

</script>
