<template>
  <v-container grid-list-md fill-height style="z-index: 10">
    <v-layout row wrap>
      <v-flex tag="h1" class="white--text" xs12>
        <span class="headline">{{ name || id }}</span>
      </v-flex>
      <v-flex xs12>
        <v-layout fill-height row>
          <v-flex xs9>
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
          <v-flex xs3 fill-height>
            <v-card >
              <v-card-title>
                {{ $t('curseforge.totalDownloads') }}
                {{ totalDownload }}
              </v-card-title>

              <v-card-title>
                {{ $t('curseforge.createdDate') }}
                {{ computeDate(createdDate) }}
              </v-card-title>

              <v-card-title>
                {{ $t('curseforge.lastUpdate') }}
                {{ computeDate(lastUpdate) }}
              </v-card-title>

              <v-card-text>
                {{ $t('curseforge.license') }}
                {{ license.name }}
              </v-card-text>
            </v-card>
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
        const { name, image, createdDate, lastUpdate, totalDownload, license, description, projectId } = await this.$repo.dispatch('fetchCurseForgeProject', { path: this.id, project: this.type });
        this.name = name;
        this.image = image;
        this.createdDate = createdDate;
        this.lastUpdate = lastUpdate;
        this.totalDownload = totalDownload;
        this.license = license;
        this.description = description;
        this.projectId = projectId;

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
    },
    getColor(type) {
      switch (type) {
        case 'R': return 'primary';
        case 'A': return 'red';
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
    install(file) {
      console.log(file);
      this.$repo.dispatch('downloadAndImportFile', {
        project: { type: this.type, name: this.name, projectId: this.projectId },
        file,
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
