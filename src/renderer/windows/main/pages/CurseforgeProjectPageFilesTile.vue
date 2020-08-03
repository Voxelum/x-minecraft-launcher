<template>
  <v-list-tile avatar>
    <v-list-tile-avatar>
      <v-chip
        label
        :color="getColor(source.releaseType)"
      >
        {{ releases[source.releaseType] }}
      </v-chip>
    </v-list-tile-avatar>
    <v-list-tile-content>
      <v-list-tile-title>{{ source.displayName }}</v-list-tile-title>
      <v-list-tile-sub-title>
        {{ (source.fileLength / 1024 / 1024).toFixed(2) }} MB,
        {{ new Date(source.fileDate).toLocaleString() }}
      </v-list-tile-sub-title>
    </v-list-tile-content>
    <v-list-tile-action v-if="!modpack">
      <v-btn
        flat
        :loading="getFileStatus(source) === 'downloading'"
        :disabled="getFileStatus(source) === 'downloaded'"
        @click="install(source)"
      >
        {{ getFileStatus(source) === 'downloaded' ? $t('curseforge.installed') : $t('curseforge.install') }}
      </v-btn>
    </v-list-tile-action>
    <v-list-tile-action v-else>
      <v-btn
        flat
        :loading="getFileStatus(source) === 'downloading'"
        :disabled="getFileStatus(source) === 'downloaded'"
        @click="download(source)"
      >
        {{ getFileStatus(source) === 'downloaded' ? $t('curseforge.downloaded') : $t('curseforge.downloadOnly') }}
      </v-btn>
    </v-list-tile-action>
    <v-list-tile-action v-if="modpack">
      <v-btn
        flat
        @click="install(source)"
      >
        {{ $t('curseforge.install') }}
      </v-btn>
    </v-list-tile-action>
  </v-list-tile>
</template>

<script lang=ts>
import { defineComponent } from '@vue/composition-api';
import {
} from '@/hooks';
import { File } from '@xmcl/curseforge';

export interface Props {
  source: File;
  install: (file: File) => Promise<void>;
  download?: (file: File) => Promise<void>;
  getFileStatus: (file: File) => string;
  modpack: boolean;
}

export default defineComponent<Props>({
  props: { source: Object, getFileStatus: Function, install: Function, modpack: Boolean, download: Function },
  setup() {
    const releases = ['', 'R', 'A', 'B'];
    function getColor(type: number) {
      switch (type) {
        case 1: return 'primary';
        case 2: return 'red';
        case 3: return 'orange';
        default:
          return '';
      }
    }
    return {
      getColor,
      releases,
    };
  },
});
</script>

<style>
.v-image__image {
  background-repeat: no-repeat;
  background-position: center center;
}
</style>
