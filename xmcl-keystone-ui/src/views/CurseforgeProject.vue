<template>
  <div
    class="h-full overflow-auto lg:p-4 p-2 lg:px-8 px-4 w-full"
  >
    <div class="flex lg:flex-row md:flex-col flex-grow lg:gap-5 gap-2 h-full max-h-full overflow-auto">
      <div
        class="flex lg:flex-col lg:flex lg:gap-5 gap-2 flex-shrink"
      >
        <Header
          :destination="destination"
          :from="from"
          :project="project"
          :loading="refreshing"
          @destination="destination = $event"
        />
        <v-card
          outlined
          class="max-h-full overflow-auto flex flex-col md:hidden lg:flex"
        >
          <v-card-title class="text-md font-bold">
            {{ t("curseforge.recentFiles") }}
          </v-card-title>
          <v-divider />
          <v-skeleton-loader
            v-if="!project"
            type="list-item-avatar-three-line, list-item-avatar-three-line, list-item-avatar-three-line, list-item-avatar-three-line, list-item-avatar-three-line"
          />
          <v-list
            v-else
            class="overflow-auto"
          >
            <v-tooltip
              v-for="file in project.latestFiles"
              :key="file.id"
              top
            >
              <template #activator="{ on }">
                <v-list-item
                  :v-ripple="getFileStatus(file) === 'remote'"
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
                      v-if="getFileStatus(file) !== 'downloading'"
                      text
                      icon
                      :disabled="getFileStatus(file) === 'downloaded' && type !== 'modpacks'"
                      @click="install(file)"
                    >
                      <v-icon>
                        {{
                          getFileStatus(file) === "downloaded" && type === 'modpacks'
                            ? "add"
                            : "download"
                        }}
                      </v-icon>
                    </v-btn>
                    <v-progress-circular
                      v-else
                      indeterminate
                      :size="24"
                      :width="2"
                    />
                  </v-list-item-action>
                </v-list-item>
              </template>
              {{ file.fileName }}
            </v-tooltip>
          </v-list>
        </v-card>
      </div>

      <v-card
        outlined
        class="flex flex-col w-full h-full overflow-auto flex-grow relative"
      >
        <v-tabs
          v-model="data.tab"
          slider-color="yellow"
          class="flex-grow-0"
        >
          <v-tab :key="0">
            {{ t("curseforge.project.description") }}
          </v-tab>
          <v-tab :key="1">
            {{ t("curseforge.project.files") }}
          </v-tab>
          <v-tab :key="2">
            {{ t("curseforge.project.images") }}
          </v-tab>
        </v-tabs>
        <v-tabs-items
          v-model="data.tab"
          class="h-full"
        >
          <v-tab-item
            :key="0"
            class="h-full max-h-full overflow-auto"
          >
            <project-description
              :project="projectId"
            />
          </v-tab-item>
          <v-tab-item
            :key="1"
            class="h-full max-h-full overflow-auto"
          >
            <project-files
              class="overflow-auto"
              :project="projectId"
              :type="type"
              :from="destination"
            />
          </v-tab-item>
          <v-tab-item
            :key="2"
            class="h-full max-h-full overflow-auto"
          >
            <images
              v-if="project"
              :screenshots="project.screenshots"
              @image="viewImage"
            />
          </v-tab-item>
        </v-tabs-items>
      </v-card>
    </div>
    <v-dialog v-model="data.viewingImage">
      <v-img
        contain
        :src="data.viewedImage"
      />
    </v-dialog>
  </div>
</template>

<script lang=ts setup>
import { File } from '@xmcl/curseforge'
import { InstanceServiceKey, ProjectType, ResourceServiceKey } from '@xmcl/runtime-api'
import ProjectDescription from './CurseforgeProjectDescription.vue'
import ProjectFiles from './CurseforgeProjectFiles.vue'
import Images from './CurseforgeProjectImages.vue'
import Header from './CurseforgeProjectHeader.vue'
import { useCurseforgeInstall, useCurseforgeProject } from '../composables/curseforge'
import { useDialog } from '../composables/dialog'
import { AddInstanceDialogKey } from '../composables/instanceAdd'
import { useService } from '@/composables'
import { getLocalDateString } from '@/util/date'

const props = withDefaults(defineProps<{
  type: ProjectType
  id: string
  from: string
}>(), {
  type: 'mc-mods',
  id: '',
  from: '',
})

const { show } = useDialog(AddInstanceDialogKey)
const projectId = computed(() => Number.parseInt(props.id, 10))
const { project, refreshing } = useCurseforgeProject(projectId.value)
const { install: installFile, getFileStatus } = useCurseforgeInstall(props.type as any, projectId.value)
const { state: resourceState } = useService(ResourceServiceKey)
const { state: instanceState } = useService(InstanceServiceKey)
const destination = ref(props.from || instanceState.path)
const { t } = useI18n()

const data = reactive({
  tab: 0,
  viewingImage: false,
  viewedImage: '',
})
const dataRefs = toRefs(data)

function viewImage(image: any) {
  data.viewingImage = true
  data.viewedImage = image.url
}
async function install(file: File) {
  if (getFileStatus(file) === 'downloaded') {
    const url = file.downloadUrl ?? `curseforge:${file.modId}:${file.id}`
    show(resourceState.queryResource(url)!.path)
  } else {
    await installFile(file, destination.value)
  }
}
watch(dataRefs.tab, () => {
  switch (data.tab) {
    case 1:
      // projectFiles.refreshFiles();
      break
    case 2:
      // projectImages.refreshImages();
      break
    default:
  }
})
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

