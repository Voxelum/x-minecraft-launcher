<template>
  <v-container grid-list-md fill-height>
    <v-layout row wrap justify-space-around>
      <v-flex tag="h1" class="white--text" xs7>
        <span class="headline">{{ $tc('curseforge.mc-mods.name', 2) }}</span>
      </v-flex>
      <v-flex xs5>
        <v-text-field hide-details :label="$t('curseforge.search')" />
      </v-flex>
      <v-flex xs6>
        <v-menu offset-y allow-overflow>
          <template v-slot:activator="{ on }">
            <v-btn color="grey darken-3" v-on="on">
              {{ $t('curseforge.sortby') }}: {{ filter.text }}
            </v-btn>
          </template>
          <v-list>
            <v-list-tile v-for="(item, index) in filters" :key="index" @click="filter = item">
              <v-list-tile-title>{{ item.text }}</v-list-tile-title>
            </v-list-tile>
          </v-list>
        </v-menu>
      </v-flex>
      <v-spacer />
      <v-flex shrink>
        <v-menu offset-y allow-overflow>
          <template v-slot:activator="{ on }">
            <v-btn color="grey darken-3" v-on="on">
              {{ $t('curseforge.gameversion') }}: {{ version.text }}
            </v-btn>
          </template>
          <v-list>
            <v-list-tile v-for="(item, index) in versions" :key="index" @click="version = item">
              <v-list-tile-title>{{ item.text }}</v-list-tile-title>
            </v-list-tile>
          </v-list>
        </v-menu>
      </v-flex>
     
      <v-flex style="overflow: auto; max-height: 60vh; min-height: 60vh;" xs12>
        <v-container v-if="loading" fill-height>
          <v-layout justify-center align-center fill-height>
            <v-progress-circular indeterminate :size="100" />
          </v-layout>
        </v-container>
        <v-flex v-for="proj in projects" :key="proj.id" d-flex xs12>
          <v-card v-ripple hover exact replace :to="`/curseforge/${type}/${proj.id}`">
            <v-layout fill-height align-center justify-center>
              <v-flex shrink>
                <v-img :src="proj.icon" :width="64">
                  <template v-slot:placeholder>
                    <v-layout
                      fill-height
                      align-center
                      justify-center
                      ma-0
                    >
                      <v-progress-circular indeterminate color="grey lighten-5" />
                    </v-layout>
                  </template>
                </v-img>
              </v-flex>
              <v-divider vertical style="padding-left: 10px;" inset />
              <v-flex xs6>
                <v-card-title>
                  <span style="font-weight: bold;"> {{ proj.name }} </span> by <span> {{ proj.author }} </span>
                  <div style="color: grey">
                    {{ proj.count }}
                    {{ new Date(Number.parseInt(proj.date, 10)).toLocaleString() }}
                  </div>
                </v-card-title>
                <v-card-text>
                  {{ proj.description }}
                </v-card-text>
              </v-flex>
              <v-flex xs4>
                <v-chip v-for="cat of proj.categories" :key="cat.title">
                  <v-avatar>
                    <img :src="cat.icon" style="max-height:30px; max-width: 30px">
                  </v-avatar>
                  {{ cat.title }}
                </v-chip>
              </v-flex>
            </v-layout>
          </v-card>
        </v-flex>
      </v-flex>
      <v-flex xs12 style="z-index: 2">
        <v-layout justify-center>
          <v-pagination v-model="page" :length="pages" total-visible="8" />
        </v-layout>
      </v-flex>
    </v-layout>
  </v-container>
</template>

<script>

export default {
  props: {
    type: {
      type: String,
      default: 'mc-mods',
    },
  },
  data() {
    return {
      page: 1,
      pages: 0,
      projects: [],
      versions: [],
      filters: [],
      version: { text: '', value: '' },
      filter: { text: '' },

      loading: false,
    };
  },
  watch: {
    page() { this.refresh(); },
    filter() { this.refresh(); },
    version() { this.refresh(); },
  },
  mounted() {
    this.refresh();
  },
  methods: {
    async refresh() {
      this.projects = [];
      this.loading = true;
      try {
        const result = await this.$repo.dispatch('fetchCurseForgeProjects', {
          project: this.type,
          page: this.page,
          filter: this.filter.text,
          version: this.version.text,
        });
        const { projects, versions, filters, pages } = result;

        this.projects = projects;
        this.versions = versions;
        this.filters = filters;
        this.pages = pages;
      } finally {
        this.loading = false;
      }
    },
  },
};
</script>

<style>
</style>
