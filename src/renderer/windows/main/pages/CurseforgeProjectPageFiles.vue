<template>
  <v-card style="overflow: auto; max-width: 100%; max-height: 70vh; min-height: 70vh">
    <v-container v-if="loading" fill-height style="min-height: 65vh;">
      <v-layout justify-center align-center fill-height>
        <v-progress-circular indeterminate :size="100" />
      </v-layout>
    </v-container>
    <v-list v-else>
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
    </v-list>
  </v-card>
</template>

<script lang=ts>
import { defineComponent } from '@vue/composition-api';
import {
  useCurseforgeProjectFiles,
  useCurseforgeInstall,
} from '@/hooks';
import {
  useNotifier,
} from '../hooks';

export default defineComponent<{ project: number }>({
  props: { project: Number },
  setup(props) {
    const { files, loading, refresh } = useCurseforgeProjectFiles(props.project);
    const { subscribe } = useNotifier();
    const releases = ['', 'R', 'A', 'B'];
    const { install, getFileStatus } = useCurseforgeInstall();
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
      files, loading, refresh, releases, getColor, install, getFileStatus,
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
