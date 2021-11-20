<template>
  <v-container grid-list-md fill-height class="h-full overflow-auto">
    <div class="flex flex-col h-full w-full max-w-full gap-5 overflow-auto">
      <div class="flex white--text flex-shrink flex-grow-0">
        <span class="headline">{{ name || id }}</span>
        <v-spacer />
        <dest-menu v-model="destination" style="flex-grow: 1" :from="from" />
      </div>
      <div class="flex lg:flex-row md:flex-col flex-grow gap-5 h-full max-h-full overflow-auto">
        <v-tabs
          v-model="tab"
          dark
          slider-color="yellow"
          class="flex flex-col w-full h-full overflow-auto flex-grow relative"
        >
          <v-tab>{{ $t("curseforge.project.description") }}</v-tab>
          <v-tab>{{ $t("curseforge.project.files") }}</v-tab>
          <v-tab>{{ $t("curseforge.project.images") }}</v-tab>
          <v-tab-item class="flex flex-col h-full max-h-full overflow-auto">
            <project-description
              class="flex flex-col h-full max-h-full overflow-auto"
              :project="projectId"
            />
          </v-tab-item>
          <v-tab-item class="overflow-auto">
            <project-files
              class="overflow-auto"
              :project="projectId"
              :type="type"
              :from="destination"
            />
          </v-tab-item>
          <v-tab-item class="overflow-auto">
            <v-card class="overflow-auto">
              <v-container v-if="false" fill-height style="min-height: 65vh">
                <v-layout justify-center align-center fill-height>
                  <v-progress-circular indeterminate :size="100" />
                </v-layout>
              </v-container>
              <v-container v-else fill-height grid-list-md>
                <v-layout row wrap>
                  <v-flex v-for="(img, index) in attachments" :key="index" d-flex>
                    <v-card flat hover style="min-width: 100px" @click="viewImage(img)">
                      <v-img :src="img.url" />
                      <v-card-title>{{ img.title }}</v-card-title>
                    </v-card>
                  </v-flex>
                </v-layout>
              </v-container>
            </v-card>
          </v-tab-item>
        </v-tabs>
        <div xs4 fill-height class="flex lg:flex-col md:hidden lg:flex gap-5 flex-shrink">
          <v-card class="min-w-25">
            <v-card-title class="flex-col items-start gap-1">
              <div style="font-weight: 500">{{ $t("curseforge.createdDate") }}</div>
              <div
                style="color: grey; padding-left: 5px"
              >{{ new Date(createdDate).toLocaleString() }}</div>
              <div style="font-weight: 500">
                <v-icon small>event</v-icon>
                {{ $t("curseforge.lastUpdate") }}
              </div>
              <div
                style="color: grey; padding-left: 5px"
              >{{ new Date(lastUpdate).toLocaleString() }}</div>
              <div style="font-weight: 500">
                <v-icon small>file_download</v-icon>
                {{ $t("curseforge.totalDownloads") }}
              </div>
              <div style="color: grey; padding-left: 5px">{{ totalDownload }}</div>
            </v-card-title>
          </v-card>
          <v-card class="max-h-full overflow-auto flex flex-col">
            <v-card-title class="text-md font-bold">{{ $t("curseforge.recentFiles") }}</v-card-title>
            <v-divider />
            <v-list class="overflow-auto">
              <v-tooltip v-for="file in recentFiles" :key="file.id" top>
                <template #activator="{ on }">
                  <v-list-tile
                    :v-ripple="getFileStatus(file) === 'remote'"
                    @click="install(file)"
                    v-on="on"
                  >
                    <v-list-tile-content>
                      <v-list-tile-title>
                        {{
                          file.displayName
                        }}
                      </v-list-tile-title>
                      <v-list-tile-sub-title>
                        {{
                          new Date(file.fileDate).toLocaleDateString()
                        }}
                      </v-list-tile-sub-title>
                    </v-list-tile-content>
                    <v-list-tile-action>
                      <v-icon v-if="getFileStatus(file) !== 'downloading'">
                        {{
                          getFileStatus(file) === "downloaded"
                            ? "dns"
                            : "cloud_download"
                        }}
                      </v-icon>
                      <v-progress-circular v-else indeterminate :size="24" :width="2" />
                    </v-list-tile-action>
                  </v-list-tile>
                </template>
                {{ file.fileName }}
              </v-tooltip>
            </v-list>
          </v-card>
        </div>
      </div>
    </div>
    <v-dialog v-model="viewingImage">
      <v-img :src="viewedImage" />
    </v-dialog>
  </v-container>
</template>

<script lang=ts>
import { defineComponent, reactive, toRefs, watch, computed, ref } from '@vue/composition-api'
import { File } from '@xmcl/curseforge'
import {
  useCurseforgeProject,
  useCurseforgeInstall,
} from '/@/hooks'
import ProjectDescription from './Description.vue'
import DestMenu from './DestMenu.vue'
import ProjectFiles from './Files.vue'
import { withDefault } from '/@/util/props'
import { ProjectType } from '/@shared/entities/curseforge'
import FilterCombobox, { useFilterCombobox } from '/@/components/FilterCombobox.vue'

interface InstallOptions {
  path?: string
}

export default defineComponent({
  components: { ProjectDescription, ProjectFiles, DestMenu, FilterCombobox },
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
