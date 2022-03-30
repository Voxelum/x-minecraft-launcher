<template>
  <div
    grid-list-md
    fill-height
    class="h-full overflow-auto lg:p-4 p-2 lg:px-8 px-4 w-full"
  >
    <div class="flex lg:flex-row md:flex-col flex-grow lg:gap-5 gap-2 h-full max-h-full overflow-auto">
      <div
        fill-height
        class="flex lg:flex-col lg:flex lg:gap-5 gap-2 flex-shrink"
      >
        <Header
          :destination="destination"
          :from="from"
          :name="name"
          :icon="attachments.length > 0 ? attachments[0].thumbnailUrl : ''"
          :creation="createdDate"
          :downloads="totalDownload"
          :updated="lastUpdate"
          :loading="refreshingProject"
          @destination="destination = $event"
        />
        <v-card
          outlined
          class="max-h-full overflow-auto flex flex-col md:hidden lg:flex"
        >
          <v-card-title class="text-md font-bold">
            {{ $t("curseforge.recentFiles") }}
          </v-card-title>
          <v-divider />
          <v-list class="overflow-auto">
            <v-tooltip
              v-for="file in recentFiles"
              :key="file.id"
              top
            >
              <template #activator="{ on }">
                <v-list-item
                  :v-ripple="getFileStatus(file) === 'remote'"
                  @click="install(file)"
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
                        new Date(file.fileDate).toLocaleDateString()
                      }}
                    </v-list-item-subtitle>
                  </v-list-item-content>
                  <v-list-item-action>
                    <v-icon v-if="getFileStatus(file) !== 'downloading'">
                      {{
                        getFileStatus(file) === "downloaded"
                          ? "dns"
                          : "download"
                      }}
                    </v-icon>
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
          v-model="tab"
          slider-color="yellow"
          class="flex-grow-0"
        >
          <v-tab :key="0">
            {{ $t("curseforge.project.description") }}
          </v-tab>
          <v-tab :key="1">
            {{ $t("curseforge.project.files") }}
          </v-tab>
          <v-tab :key="2">
            {{ $t("curseforge.project.images") }}
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
            <project-description
              class="flex flex-col h-full max-h-full overflow-auto"
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
              :attachments="attachments"
              @image="viewImage"
            />
          </v-tab-item>
        </v-tabs-items>
      </v-card>
    </div>
    <v-dialog v-model="viewingImage">
      <v-img :src="viewedImage" />
    </v-dialog>
  </div>
</template>

<script lang=ts>
import { File } from '@xmcl/curseforge'
import { ProjectType } from '@xmcl/runtime-api'
import { withDefault } from '/@/util/props'
import ProjectDescription from './CurseforgeProjectDescription.vue'
import ProjectFiles from './CurseforgeProjectFiles.vue'
import Images from './CurseforgeProjectImages.vue'
import Header from './CurseforgeProjectHeader.vue'
import { useCurseforgeInstall, useCurseforgeProject } from '../composables/curseforge'

export default defineComponent({
  components: { ProjectDescription, ProjectFiles, Images, Header },
  props: {
    type: withDefault<ProjectType>((String as any), () => 'mc-mods'),
    id: withDefault(String, () => ''),
    from: withDefault(String, () => ''),
  },
  setup(props) {
    const projectId = computed(() => Number.parseInt(props.id, 10))
    const project = useCurseforgeProject(projectId.value)
    const { install: installFile, getFileStatus } = useCurseforgeInstall(props.type as any, projectId.value)
    const destination = ref(props.from || '')

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
      if (getFileStatus(file) === 'downloaded') return
      await installFile(file, destination.value)
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
    return {
      viewImage,
      install,
      getFileStatus,
      ...toRefs(data),
      ...project,
      projectId,
      destination,
    }
  },
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
