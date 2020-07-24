<template>
  <v-container grid-list-md fill-height>
    <v-layout row wrap justify-space-around>
      <v-flex tag="h1" class="white--text" xs7>
        <span class="headline">{{ $tc(`curseforge.${type}.name`, 2) }}</span>
      </v-flex>
      <v-flex xs5>
        <v-text-field
          v-model="keyword"
          append-icon="search"
          hide-details
          :label="$t('curseforge.search')"
          @keydown.enter="search()"
        />
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
                <v-img :src="proj.attachments[0].thumbnailUrl" :width="64">
                  <template v-slot:placeholder>
                    <v-layout fill-height align-center justify-center ma-0>
                      <v-progress-circular indeterminate color="grey lighten-5" />
                    </v-layout>
                  </template>
                </v-img>
              </v-flex>
              <v-divider vertical style="padding-left: 10px;" inset />
              <v-flex xs6>
                <v-card-title>
                  <span style="font-weight: bold;">{{ proj.name }}</span>
                  <span style="padding-left: 3px;">by {{ proj.authors[0].name }}</span>
                  <div style="color: grey; padding-left: 5px;">
                    <!-- {{ proj.downloadCount }} -->
                    {{ new Date(proj.dateModified || proj.dateCreated).toLocaleDateString() }}
                  </div>
                </v-card-title>
                <v-card-text>{{ proj.summary }}</v-card-text>
              </v-flex>
              <v-flex xs4 style="padding-top: 10px;">
                <v-chip v-for="cat of proj.categories" :key="cat.categoryId">
                  <v-avatar>
                    <img :src="cat.avatarUrl" style="max-height:30px; max-width: 30px" />
                  </v-avatar>
                  {{ cat.name }}
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

<script lang=ts>
import { defineComponent } from '@vue/composition-api';
import { useCurseforgeSearch } from '@/hooks';

export default defineComponent({
  props: {
    type: {
      type: String,
      default: 'mc-mods',
    },
    initialKeyword: String,
  },
  setup(props) {
    // const { categories } = useCurseforgeCategories();
    let id: number;
    switch (props.type) {
      default:
      case 'mc-mods':
        id = 6;
        break;
      case 'modpacks':
        id = 4471;
        break;
      case 'texture-packs':
        id = 12;
        break;
      case 'worlds':
        id = 17;
        break;
    }
    return useCurseforgeSearch(id, props.initialKeyword);
  },
});
</script>

<style>
</style>
