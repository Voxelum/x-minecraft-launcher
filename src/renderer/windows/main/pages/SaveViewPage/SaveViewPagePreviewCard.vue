<template>
  <v-card flat hover dark draggable class="white--text">
    <v-img
      :class="{ 'grey': true, 'darken-2': true }"
      class="white--text favicon"
      :src="value.icon"
      :lazy-src="unknown"
      style="max-height: 200px;"
    >
      <v-container fill-height fluid>
        <v-layout justfiy-center align-center row wrap>
          <v-flex xs12 layout align-center>
            <v-icon left>
              map
            </v-icon>
            <h1 class="headline" style="font-size: 32px important;">
              {{ value.name }}
            </h1>
          </v-flex>
        </v-layout>
      </v-container>
    </v-img>
    <!-- <v-layout>
      <v-flex>
        <v-card-title primary-title>
          <div>
          </div>
        </v-card-title>
      </v-flex>
    </v-layout>
    <v-divider light /> -->
    <v-card-actions>
      <v-btn flat icon @click="exportSave(value.path)">
        <v-icon>
          launch
        </v-icon>
        <!-- {{ $t('save.export') }} -->
      </v-btn>
      <v-btn color="red" icon flat @click="deleteSave(value.path)"> 
        <v-icon>
          delete
        </v-icon>
        <!-- {{ $t('save.deleteTitle') }} -->
      </v-btn>
      <v-spacer />
      <v-btn flat @click="showDetail">
        <v-icon left>
          info
        </v-icon>
        {{ $t('save.detail') }}
      </v-btn>
    </v-card-actions>
  </v-card>
</template>

<script lang=ts>
import { createComponent } from '@vue/composition-api';
import { SaveMetadata } from '@universal/store/modules/instance';
import unknown from '@/assets/unknown_pack.png';

export interface Props {
  exportSave: (path: string) => void;
  deleteSave: (path: string) => void;
  value: SaveMetadata;
}

export default createComponent<Props>({
  props: {
    exportSave: {
      type: Function,
    },
    deleteSave: {
      type: Function,
    },
    value: {
      type: Object,
    },
  },
  setup() { return { unknown }; },
});
</script>

<style>
</style>
