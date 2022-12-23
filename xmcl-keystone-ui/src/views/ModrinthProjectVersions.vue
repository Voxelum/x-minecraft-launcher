<template>
  <v-card class="h-full overflow-hidden flex flex-col">
    <div class="flex gap-5 mx-5 mt-3 overflow-hidden">
      <v-select
        v-model="gameVersion"
        clearable
        hide-details
        flat
        solo
        dense
        :items="gameVersions"
        :label="t('modrinth.gameVersions.name')"
      />
      <v-select
        v-model="modLoader"
        clearable
        hide-details
        flat
        solo
        dense
        :items="modLoaders"
        :label="t('modrinth.modLoaders.name')"
      />
      <v-select
        v-model="releaseType"
        clearable
        hide-details
        flat
        solo
        dense
        :items="releaseTypes"
        :label="t('versionType.name')"
      />
    </div>
    <v-skeleton-loader
      v-if="refreshing"
      type="table-thead, table-tbody"
    />
    <ErrorView
      v-else-if="versionsError"
      :error="versionsError"
      @refresh="refresh"
    />
    <div
      v-else
      class="h-full overflow-auto"
      style="border-spacing: 0.75em"
    >
      <div
        class="text-gray-400 font-bold text-lg align-middle grid grid-cols-13 my-4"
      >
        <div
          role="presentation col-span-1"
        />
        <div class="col-span-4 text-left ">
          {{ t('modrinth.headers.version') }}
        </div>
        <div class="col-span-4 text-left ">
          {{ t('modrinth.headers.support') }}
        </div>
        <div class="col-span-4 text-left ">
          {{ t('modrinth.headers.status') }}
        </div>
      </div>
      <VirtualList
        :data-component="ModrinthProjectVersionsTile"
        :data-key="'id'"
        class="v-list overflow-auto transition-none"
        :data-sources="items"
        :estimate-size="120"
        :extra-props="{ isDownloaded, onInstall, relatedTasks }"
      />
    </div>
  </v-card>
</template>

<script lang="ts" setup>
import ErrorView from '@/components/ErrorView.vue'
import { kModrinthVersions, kModrinthVersionsStatus } from '@/composables/modrinthVersions'
import { kTaskManager } from '@/composables/taskManager'
import { TaskItem } from '@/entities/task'
import { injection } from '@/util/inject'
import { ProjectVersion } from '@xmcl/modrinth'
import { TaskState } from '@xmcl/runtime-api'
import ModrinthProjectVersionsTile from './ModrinthProjectVersionsTile.vue'
import VirtualList from 'vue-virtual-scroll-list'

const props = defineProps<{
  versions: string[]
  project: string
  modpack: boolean
}>()

const emit = defineEmits(['install'])
const onInstall = (v: ProjectVersion) => emit('install', v)

const { versions: projectVersions, error: versionsError, refresh, refreshing } = injection(kModrinthVersions)
const { isDownloaded } = injection(kModrinthVersionsStatus)

const { t } = useI18n()
const gameVersions = computed(() => projectVersions.value.map(v => v.game_versions).reduce((a, b) => [...a, ...b], []))
const gameVersion = ref('')
const releaseTypes = computed(() => [
  { text: t('versionType.alpha'), value: 'alpha' },
  { text: t('versionType.beta'), value: 'beta' },
  { text: t('versionType.release'), value: 'release' },
])
const releaseType = ref('')
const modLoaders = ['forge', 'fabric']
const modLoader = ref('')

const { tasks } = injection(kTaskManager)
const relatedTasks = computed(() => {
  const all = tasks.value.filter(t => t.state === TaskState.Running && t.path === 'installModrinthFile' && t.param.projectId === props.project)
  const dict = {} as Record<string, TaskItem>
  for (const t of all) {
    dict[t.param.versionId] = t
  }
  return dict
})
const items = computed(() => projectVersions.value.filter(v => {
  if (gameVersion.value) {
    return v.game_versions.indexOf(gameVersion.value) !== -1
  }
  if (releaseType.value) {
    return v.version_type === releaseType.value
  }
  if (modLoader.value) {
    return v.loaders.indexOf(modLoader.value) !== -1
  }
  return true
}))

onMounted(refresh)
</script>
