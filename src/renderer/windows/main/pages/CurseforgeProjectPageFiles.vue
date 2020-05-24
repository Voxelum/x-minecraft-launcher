<template>
  <v-card style="overflow: auto; max-width: 100%; max-height: 70vh; min-height: 70vh">
    <v-container v-if="loading" fill-height style="min-height: 65vh;">
      <v-layout justify-center align-center fill-height>
        <v-progress-circular indeterminate :size="100" />
      </v-layout>
    </v-container>
    <v-list v-else>
      <virtual-list :size="56" :remain="9">
        <v-list-tile v-for="file in files" :key="file.id" avatar>
          <v-list-tile-avatar>
            <v-chip label :color="getColor(file.releaseType)">{{ releases[file.releaseType] }}</v-chip>
          </v-list-tile-avatar>
          <v-list-tile-content>
            <v-list-tile-title>{{ file.displayName }}</v-list-tile-title>
            <v-list-tile-sub-title>
              {{ (file.fileLength / 1024 / 1024).toFixed(2) }} MB,
              {{ new Date(file.fileDate).toLocaleString() }}
            </v-list-tile-sub-title>
          </v-list-tile-content>
          <v-list-tile-action>
            <v-btn
              flat
              :loading="getFileStatus(file) === 'downloading'"
              :disabled="getFileStatus(file) === 'downloaded'"
              @click="install(file)"
            >{{ getFileStatus(file) === 'downloaded' ? $t('curseforge.installed') : $t('curseforge.install') }}</v-btn>
          </v-list-tile-action>
        </v-list-tile>
      </virtual-list>
    </v-list>
  </v-card>
</template>

<script lang=ts>
import VirtualList from 'vue-virtual-scroll-list';
import { defineComponent, computed, inject, ref } from '@vue/composition-api';
import { ProjectType } from '@universal/store/modules/curseforge';
import {
  useCurseforgeProjectFiles,
  useCurseforgeInstall,
} from '@/hooks';

export default defineComponent<{ project: number; type: ProjectType }>({
  components: { VirtualList },
  props: { project: Number, type: String },
  setup(props) {
    const { files, loading, refresh } = useCurseforgeProjectFiles(props.project);
    const releases = ['', 'R', 'A', 'B'];
    const { install, getFileStatus } = useCurseforgeInstall(props.type);
    function getColor(type: number) {
      switch (type) {
        case 1: return 'primary';
        case 2: return 'red';
        case 3: return 'orange';
        default:
          return '';
      }
    }
    const text = inject('search-text', ref(''));
    return {
      files: computed(() => files.value.filter(f => f.displayName.indexOf(text.value) !== -1)), loading, refresh, releases, getColor, install, getFileStatus,
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
