<template>
  <div
    class="w-full overflow-auto p-2 px-4 lg:p-4 lg:px-8"
  >
    <div class="flex h-full max-h-full flex-grow gap-2 overflow-auto md:flex-col lg:flex-row lg:gap-5">
      <div
        class="lg:(w-80 max-w-80) flex flex-shrink gap-2 lg:flex lg:flex-col lg:gap-5"
      >
        <ErrorView
          :error="error"
          @refresh="refresh"
        />
        <CurseforgeProjectHeader
          :destination="destination"
          :from="destination"
          :project="project"
          :loading="refreshing && !project"
          @destination="destination = $event"
        />
        <CurseforgeProjectRecentFiles
          v-if="project"
          :project="project"
          :from="destination"
        />
      </div>

      <div class="flex h-full flex-grow flex-col gap-2 overflow-auto lg:gap-5">
        <v-card
          outlined
          class="relative flex flex-grow flex-col overflow-auto"
        >
          <v-tabs
            v-model="tab"
            slider-color="yellow"
            class="flex-grow-0"
          >
            <v-tab :key="0">
              {{ t("curseforge.project.description") }}
            </v-tab>
            <v-tab :key="1">
              {{ t("curseforge.project.files") }}
            </v-tab>
            <v-tab
              v-if="project && project.screenshots.length > 0"
              :key="2"
            >
              {{ t("curseforge.project.images") }}
            </v-tab>
          </v-tabs>
          <v-tabs-items
            v-model="tab"
            class="h-full"
          >
            <v-tab-item
              :key="0"
              class="h-full max-h-full overflow-auto"
            >
              <CurseforgeProjectDescription
                :project="modId"
              />
            </v-tab-item>
            <v-tab-item
              :key="1"
              class="h-full max-h-full overflow-auto"
            >
              <CurseforgeProjectFiles
                class="overflow-auto"
                :project="modId"
                :type="type"
                :from="destination"
                :game-versions="gameVersions"
                :mod-loaders="modLoaders"
              />
            </v-tab-item>
            <v-tab-item
              v-if="project && project.screenshots.length > 0"
              :key="2"
              class="h-full max-h-full overflow-auto"
            >
              <CurseforgeProjectImages
                v-if="project"
                :screenshots="project.screenshots"
                @image="imageDialog.show"
              />
            </v-tab-item>
          </v-tabs-items>
        </v-card>
      </div>
    </div>
  </div>
</template>

<script lang=ts setup>
import ErrorView from '@/components/ErrorView.vue'
import { kImageDialog } from '@/composables/imageDialog'
import { kInstance } from '@/composables/instance'
import { usePresence } from '@/composables/presence'
import { useSWRVModel } from '@/composables/swrv'
import { injection } from '@/util/inject'
import { File } from '@xmcl/curseforge'
import { ProjectType } from '@xmcl/runtime-api'
import { getCurseforgeProjectModel, kCurseforgeFiles } from '../composables/curseforge'
import { kCurseforgeInstall, useCurseforgeInstall } from '../composables/curseforgeInstall'
import CurseforgeProjectDescription from './CurseforgeProjectDescription.vue'
import CurseforgeProjectFiles from './CurseforgeProjectFiles.vue'
import CurseforgeProjectHeader from './CurseforgeProjectHeader.vue'
import CurseforgeProjectImages from './CurseforgeProjectImages.vue'
import CurseforgeProjectRecentFiles from './CurseforgeProjectRecentFiles.vue'

const props = withDefaults(defineProps<{
  type: ProjectType
  id: string
  from: string
}>(), {
  type: 'mc-mods',
  id: '',
  from: '',
})

// Curseforge Project
const modId = computed(() => Number.parseInt(props.id, 10))
const { data: project, isValidating: refreshing, error, mutate: refresh } = useSWRVModel(getCurseforgeProjectModel(modId))

// Curseforge files
const files = ref([] as File[])
provide(kCurseforgeFiles, files)

const allFiles = computed(() => {
  if (project.value) {
    return [...files.value.map(v => ({ id: v.id, modId: modId.value })), ...project.value.latestFilesIndexes.map(v => ({ id: v.fileId, modId: modId.value }))]
  }
  return files.value.map(v => ({ id: v.id, modId: modId.value }))
})

// The instance source
const { path } = injection(kInstance)
const destination = ref(props.from || path.value)

// I18n
const { t } = useI18n()

// Common Curseforge install function
provide(kCurseforgeInstall, useCurseforgeInstall(modId, allFiles, path, computed(() => props.type), computed(() => undefined)))

const gameVersions = computed(() => {
  const index = project.value?.latestFilesIndexes
  if (!index) return []
  return index.map(i => i.gameVersion)
})
const modLoaders = computed(() => {
  const all = [
    'Any',
    'Forge',
    'Cauldron',
    'LiteLoader',
    'Fabric',
    'Quilt',
  ]
  const index = project.value?.latestFilesIndexes
  if (!index) return []
  const loaders = new Set(index.filter(i => i.modLoader).map(i => i.modLoader))
  return all.filter((a, i) => loaders.has(i))
})

// Image dialog
const imageDialog = injection(kImageDialog)

// Tab
const tab = ref(0)

usePresence(computed(() => t('presence.curseforgeProject', { name: project.value?.name || props.id })))
</script>

<style>
.v-image__image {
  background-repeat: no-repeat;
  background-position: center center;
}

.headline {
  text-align: center;
}
</style>
