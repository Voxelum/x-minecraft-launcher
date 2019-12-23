<template>
  <v-container grid-list-md fill-height style="z-index: 10; padding">
    <v-layout row wrap>
      <v-flex tag="h1" class="white--text" xs12>
        <span class="headline">{{ name || id }}</span>
      </v-flex>
      <v-flex xs12>
        <v-layout fill-height row>
          <v-flex xs8>
            <v-tabs v-model="tab" dark slider-color="yellow">
              <v-tab>
                {{ $t('curseforge.project.description') }}
              </v-tab>
              <v-tab>
                {{ $t('curseforge.project.files') }}
              </v-tab>
              <v-tab>
                {{ $t('curseforge.project.images') }}
              </v-tab>
              <v-tab-item>
                <v-card style="overflow: auto; max-width: 100%; max-height: 70vh; min-height: 70vh;">
                  <v-card-text v-if="!refreshingProject" v-html="description" />
                  <v-container v-else fill-height style="min-height: 65vh;">
                    <v-layout justify-center align-center fill-height>
                      <v-progress-circular indeterminate :size="100" />
                    </v-layout>
                  </v-container>
                </v-card>
              </v-tab-item>
              <v-tab-item>
                <v-card style="overflow: auto; max-width: 100%; max-height: 70vh; min-height: 70vh">
                  <v-container v-if="refreshingFile" fill-height style="min-height: 65vh;">
                    <v-layout justify-center align-center fill-height>
                      <v-progress-circular indeterminate :size="100" />
                    </v-layout>
                  </v-container>
                  <v-list v-else>
                    <v-list-tile v-for="(file, index) in files" :key="file.href" avatar>
                      <v-list-tile-avatar>
                        <v-chip label :color="getColor(file.type)">
                          {{ file.type }}
                        </v-chip>
                      </v-list-tile-avatar>
                      <v-list-tile-content>
                        <v-list-tile-title>
                          {{ file.name }}
                        </v-list-tile-title>
                        <v-list-tile-sub-title>
                          {{ file.size }},
                          {{ file.downloadCount }},
                          {{ computeDate(file.date) }}
                        </v-list-tile-sub-title>
                      </v-list-tile-content>
                      <v-list-tile-action>
                        <v-btn flat :loading="isFileDownloading(file)" :disabled="fileStats[index]" @click="install(file)">
                          {{ fileStats[index] ? $t('curseforge.installed') : $t('curseforge.install') }}
                        </v-btn>
                      </v-list-tile-action>
                    </v-list-tile>
                  </v-list>
                  <v-pagination v-if="!refreshingFile" v-model="page" :length="pages" />
                </v-card>
              </v-tab-item>
              <v-tab-item>
                <v-card style="overflow: auto; max-width: 100%; max-height: 70vh; min-height: 70vh">
                  <v-container v-if="refreshingImages" fill-height style="min-height: 65vh;">
                    <v-layout justify-center align-center fill-height>
                      <v-progress-circular indeterminate :size="100" />
                    </v-layout>
                  </v-container>
                  <v-container v-else fill-height grid-list-md>
                    <v-layout row wrap>
                      <v-flex v-for="(img, index) in images" :key="index" d-flex>
                        <v-card flat hover style="min-width: 100px;" @click="viewImage(img)">
                          <v-img :src="img.url" />
                          <v-card-title>
                            {{ img.name }}
                          </v-card-title>
                        </v-card>
                      </v-flex>
                    </v-layout>
                  </v-container>
                </v-card>
              </v-tab-item>
            </v-tabs>
          </v-flex>
          <v-flex xs4 fill-height>
            <v-layout column>
              <v-flex xs6>
                <v-card style="max-height: 214px; min-height: 214px;">
                  <v-card-title>
                    <div style="font-weight: 500;">
                      {{ $t('curseforge.createdDate') }}
                    </div>
                    <div style="color: grey; padding-left: 5px">
                      {{ computeDate(createdDate) }}
                    </div>

                    <div style="font-weight: 500;">
                      {{ $t('curseforge.lastUpdate') }}
                    </div>
                    <div style="color: grey; padding-left: 5px">
                      {{ computeDate(lastUpdate) }}
                    </div>
                    <div style="font-weight: 500;">
                      {{ $t('curseforge.totalDownloads') }}
                    </div>
                    <span style="color: grey; padding-left: 5px">
                      {{ totalDownload }}
                    </span>
                  </v-card-title>
                  <v-card-text>
                    <div style="font-weight: 500;">
                      {{ $t('curseforge.license') }}
                    </div>
                    <p style="color: grey;">
                      {{ license.trim() }}
                    </p>
                  </v-card-text>
                </v-card>
              </v-flex>
              <v-flex xs6>
                <v-card style="max-height: 232px; min-height: 232px;">
                  <v-card-title primary-title style="font-weight: 500;">
                    {{ $t('curseforge.recentFiles') }}
                  </v-card-title>
                  <div style="max-height: 160px; min-height: 160px; overflow: auto">
                    <v-list>
                      <v-tooltip v-for="(file, i) in recentFiles" :key="file.href" top>
                        <template v-slot:activator="{ on }">
                          <v-list-tile :v-ripple="!recentFilesStat[i]" @click="installPreview(file, i)" v-on="on">
                            <v-list-tile-content>
                              <v-list-tile-title>{{ file.name }}</v-list-tile-title>
                              <v-list-tile-sub-title>
                                {{ computeDate(file.date) }}
                              </v-list-tile-sub-title>
                            </v-list-tile-content>
                            <v-list-tile-action>
                              <v-icon v-if="!isFileDownloading(file)">
                                {{ recentFilesStat[i] ? 'dns' : 'cloud_download' }}
                              </v-icon>
                              <v-progress-circular v-else indeterminate :size="24" :width="2" />
                            </v-list-tile-action>
                          </v-list-tile>
                        </template>
                        {{ file.name }}
                      </v-tooltip>
                    </v-list>
                  </div>
                </v-card>
              </v-flex>
            </v-layout>
          </v-flex>
        </v-layout>
      </v-flex>
    </v-layout>
    <v-dialog v-model="viewingImage">
      <v-img :src="viewedImage" />
    </v-dialog>
  </v-container>
</template>

<script lang=ts>
import { createComponent, reactive, computed, onMounted, toRefs, watch } from '@vue/composition-api';
import { ProjectType } from 'main/service/CurseForgeService';
import { 
  useCurseforgeProject, 
  useCurseforgeProjectFiles, 
  useCurseforgeImages, 
  useStore, 
  useNotifier,
} from '@/hooks';

export default createComponent({
  props: {
    type: {
      type: String,
      default: 'mc-mods',
    },
    id: {
      type: String,
      required: true,
      default: '',
    },
  },
  setup(props) {
    const type = props.type as ProjectType;
    const project = useCurseforgeProject(props.id, type);
    const projectRefs = toRefs(project);
    const projectFiles = useCurseforgeProjectFiles(props.id, type, projectRefs.projectId);
    const projectImages = useCurseforgeImages(props.id, type);
    const { subscribe } = useNotifier();

    const { state, getters } = useStore();
    const isFileDownloading = (file: { href: string }) => state.curseforge.downloading[file.href];
    const fileStats = computed(() => projectFiles.files.value.map(file => getters.isFileInstalled(file)));
    const data = reactive({
      tab: 0,
      viewingImage: false,
      viewedImage: '',
    });
    const dataRefs = toRefs(data);

    function viewImage(image: any) {
      data.viewingImage = true;
      data.viewedImage = image.url;
    }
    function getColor(type: string) {
      switch (type) {
        case 'release':
        case 'R': return 'primary';
        case 'alpha':
        case 'A': return 'red';
        case 'beta':
        case 'B': return 'orange';
        default:
          return '';
      }
    }
    function computeDate(date: string | number) {
      const d = new Date(0);
      d.setUTCSeconds(typeof date === 'string' ? Number.parseInt(date, 10) : date);
      return d.toLocaleDateString();
    }

    watch(dataRefs.tab, () => {
      switch (data.tab) {
        case 1:
          projectFiles.refreshFiles();
          break;
        case 2:
          projectImages.refreshImages();
          break;
        default:
      }
    });
    onMounted(() => {
      project.refresh();
    });
    return {
      getColor,
      computeDate,
      viewImage,
       
      ...dataRefs,
      ...projectRefs,
      ...projectImages,
      ...projectFiles,
      fileStats,
      isFileDownloading,
      async install(download: any) {
        const promise = projectFiles.install(download);
        if (props.type === 'modpacks') {
          subscribe(promise, () => 'Download Success! Please create the instance by this modpack in instances panel', () => 'Fail to download this modpack!');
        }
        return promise;
      },
    };
  },
  methods: {

  },
});
</script>

<style>
.v-image__image {
  background-repeat: no-repeat;
  background-position: center center;
}
</style>
