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
                    <div style="color: grey">
                      {{ computeDate(createdDate) }}
                    </div>

                    <div style="font-weight: 500;">
                      {{ $t('curseforge.lastUpdate') }}
                    </div>
                    <div style="color: grey">
                      {{ computeDate(lastUpdate) }}
                    </div>
                  </v-card-title>
                  <v-card-text>
                    <div style="font-weight: 500;">
                      {{ $t('curseforge.totalDownloads') }}
                    </div>
                    <div style="color: grey">
                      {{ totalDownload }}
                    </div>
                    <div style="font-weight: 500;">
                      {{ $t('curseforge.license') }}
                    </div>
                    <div style="color: grey">
                      {{ license.name }}
                    </div>
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

<script>
export default {
  props: {
    type: {
      type: String,
      default: 'mc-mods',
    },
    id: {
      type: String,
      required: true,
    },
  },
  data() {
    return {
      tab: 0,
      viewingImage: false,
      viewedImage: '',

      projectId: '',
      name: '',
      image: '',
      createdDate: '',
      lastUpdate: '',
      totalDownload: '',
      license: '',
      description: '',
      recentFiles: [],

      page: 1,
      pages: 1,
      version: '',

      versions: [],
      files: [],
      images: [],

      refreshingProject: false,
      refreshingFile: false,
      refreshingImages: false,
    };
  },
  computed: {
    recentFilesStat() {
      return this.recentFiles.map(file => this.$repo.getters.isFileInstalled(file));
    },
    fileStats() {
      return this.files.map(file => this.$repo.getters.isFileInstalled(file));
    },
  },
  watch: {
    page() { this.refreshFile(); },
    version() { this.refreshFile(); },
    tab() {
      switch (this.tab) {
        case 1:
          this.refreshFile();
          break;
        case 2:
          this.refreshImages();
          break;
        default:
      }
    },
  },
  mounted() {
    this.refresh();
  },
  methods: {
    async refresh() {
      this.refreshingProject = true;
      try {
        const { name, image, createdDate, updatedDate, totalDownload, license, description, projectId, files } = await this.$repo.dispatch('fetchCurseForgeProject', { path: this.id, project: this.type });
        this.name = name;
        this.image = image;
        this.createdDate = createdDate;
        this.lastUpdate = updatedDate;
        this.totalDownload = totalDownload;
        this.license = license;
        this.description = description;
        this.projectId = projectId;
        this.recentFiles = files;

        const imgs = this.$el.getElementsByTagName('img');
        for (let i = 0; i < imgs.length; ++i) {
          imgs.item(i).addEventListener('click', () => {
            this.viewImage({ url: imgs.item(i).getAttribute('src') });
          });
        }
      } finally {
        this.refreshingProject = false;
      }
    },
    async refreshFile() {
      this.refreshingFile = true;
      try {
        const { versions, files, pages } = await this.$repo.dispatch('fetchCurseForgeProjectFiles', {
          project: this.type,
          path: this.id,
          version: this.version,
          page: this.page,
        });
        this.pages = pages;
        this.versions = versions;
        // this.files = [];
        // await this.$nextTick();
        // for (const file of files) {
        //   this.files.push(file);
        //   await this.$nextTick();
        // }
        this.files = files;
      } finally {
        this.refreshingFile = false;
      }
    },
    async refreshImages() {
      this.refreshingImages = true;
      try {
        const images = await this.$repo.dispatch('fetchCurseforgeProjectImages', {
          type: this.type,
          path: this.id,
        });
        this.images = images;
      } finally {
        this.refreshingImages = false;
      }
    },
    async fetchFileChangelog() {
      // todo: impl this
    },
    getColor(type) {
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
    },
    computeDate(date) {
      const d = new Date(0);
      d.setUTCSeconds(Number.parseInt(date, 10));
      return d.toLocaleDateString();
    },
    /**
     * @type {import('universal/store/modules/curseforge').CurseforgeModule.Download}
     */
    install(file) {
      this.$repo.dispatch('downloadAndImportFile', {
        id: file.id,
        name: file.name,
        href: file.href,
        projectType: this.type,
        projectPath: this.id,
        projectId: this.projectId,
      });
    },
    installPreview(file, index) {
      if (this.recentFilesStat[index]) return;
      if (this.isFileDownloading(file.href)) return;
      this.$repo.dispatch('downloadAndImportFile', {
        id: file.id,
        name: file.name,
        href: file.href,
        projectType: this.type,
        projectPath: this.id,
        projectId: this.projectId,
      });
    },
    isFileDownloading(file) {
      return !!this.$repo.state.curseforge.downloading[file.href];
    },
    viewImage(image) {
      this.viewingImage = true;
      this.viewedImage = image.url;
    },
  },
};
</script>

<style>
.v-image__image {
  background-repeat: no-repeat;
  background-position: center center;
}
</style>
