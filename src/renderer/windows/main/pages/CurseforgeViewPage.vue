<template>
  <v-container grid-list-md fill-height>
    <v-layout row wrap justify-space-around>
      <v-flex tag="h1" class="white--text" xs7>
        <span class="headline">{{ $tc(`curseforge.${type}.name`, 2) }}</span>
      </v-flex>
      <v-flex xs5>
        <v-text-field v-model="keyword" append-icon="search" hide-details :label="$t('curseforge.search')" @keydown.enter="search()" />
      </v-flex>
      <v-flex v-if="searchMode" xs6>
        <v-btn color="grey darken-3" @click="searchMode = false">
          <v-icon left>
            close
          </v-icon>
          {{ $t('curseforge.quitSearch') }}
        </v-btn>
      </v-flex>
      <v-flex v-if="!searchMode" xs6>
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
      <v-flex v-if="!searchMode" shrink>
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
        <v-flex v-for="proj in projects" :key="proj.name" d-flex xs12>
          <v-card v-ripple hover exact replace :to="`/curseforge/${type}/${proj.name}`">
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
                  <span style="font-weight: bold;"> {{ proj.name }} </span>  <span style="padding-left: 3px;"> by {{ proj.author }} </span>
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
          <v-pagination v-model="page" :disabled="searchMode" :length="pages" total-visible="8" />
        </v-layout>
      </v-flex>
    </v-layout>
  </v-container>
</template>

<script>
import { createComponent, reactive, toRefs, watch } from "@vue/composition-api";
import { useCurseforgePreview } from "@/hooks";

export default createComponent({
  props: {
    type: {
      type: String,
      default: 'mc-mods',
    },
  },
  setup(props) {
    const preview = useCurseforgePreview(props.type);
    return {
      ...preview,
    }
  },
});
</script>

<style>
</style>
