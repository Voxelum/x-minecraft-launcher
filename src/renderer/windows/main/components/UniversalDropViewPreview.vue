<template>
  <v-flex
    style="display: flex; flex-direction: column; height: 100%;"
  >
    <v-card-text class="headline font-weight-bold">{{ $t('dropToImport') }}</v-card-text>
    <v-divider></v-divider>
    <v-list style="overflow: auto">
      <file-list-tile
        v-for="file in previews"
        :key="file.name"
        :value="file"
        @remove="remove(file)"
      />
    </v-list>
    <v-spacer />
    <v-divider></v-divider>
    <v-card-actions>
      <v-btn large flat @click="cancel">{{ $t('cancel') }}</v-btn>
      <v-spacer />
      <v-btn
        large
        flat
        color="primary"
        :loading="loading"
        :disabled="disabled"
        @click="start"
      >
        {{ $t('profile.import.start') }}
      </v-btn>
    </v-card-actions>
  </v-flex>
</template>

<script lang=ts>
import { useFileDrop } from '@/hooks';
import { required } from '@/util/props';
import { FileMetadata } from '@main/service/IOService';
import { Resource } from '@universal/entities/resource';
import { defineComponent, computed, ref } from '@vue/composition-api';
import { ResourceDomain, ResourceType } from '@universal/entities/resource.schema';
import FileListTile from './UniversalDropViewFileListTile.vue';

export interface FilePreview extends FileMetadata {
  name: string;
  size: number;
  enabled: boolean;
  status: 'loading' | 'idle' | 'failed' | 'saved';
}

export default defineComponent({
  components: {
    FileListTile,
  },
  props: {
    previews: required<FilePreview[]>(Array),
  },
  setup(props, context) {
    const status = ref([] as boolean[]);
    const { importFile } = useFileDrop();
    const loading = computed(() => props.previews.some((v) => v.status === 'loading'));
    const pendings = computed(() => props.previews.filter((v) => (v.status === 'idle' || v.status === 'failed')
      && !v.existed
      && (v.type !== ResourceType.Unknown)
      && v.enabled));
    const disabled = computed(() => pendings.value.length === 0);
    function remove(file: FilePreview) {
      props.previews = props.previews.filter((p) => p.path !== file.path);
      if (props.previews.length === 0) {
        cancel();
      }
    }
    function cancel() {
      context.emit('cancel');
    }
    function start() {
      const promises = [] as Promise<any>[];
      for (const preview of pendings.value) {
        preview.status = 'loading';
        const promise = importFile(preview).then(() => {
          preview.status = 'saved';
        }, (e) => {
          console.log(`Failed to import resource ${preview.path}`);
          console.log(e);
          preview.status = 'failed';
        });
        promises.push(promise);
      }
      Promise.all(promises).then(() => {
        cancel();
      });
    }
    return {
      remove,
      cancel,
      start,
      loading,
      disabled,
    };
  },
});
</script>
