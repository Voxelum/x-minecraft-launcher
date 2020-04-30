<template>
  <v-container grid-list-xs fill-height style="overflow: auto;">
    <v-layout column>
      <v-layout style="flex-grow: 0" align-content-start justify-start>
        <v-flex tag="h1" class="white--text" style="z-index: 1">
          <span class="headline">{{ $tc('save.name', 2) }}</span>
        </v-flex>
        <v-flex shrink style="z-index: 1">
          <v-btn flat @click="showCopyFromDialog">
            <v-icon left>
              input
            </v-icon>
            {{ $t('save.copyFrom.title') }}
          </v-btn>
        </v-flex>
        <v-flex shrink style="z-index: 1">
          <v-btn flat @click="doImport">
            <v-icon left>
              move_to_inbox
            </v-icon>
            {{ $t('save.import') }}
          </v-btn>
        </v-flex>
      </v-layout>
      <v-layout style="flex-grow: 1" @drop.prevent="onDrop" @dragover.prevent>
        <hint v-if="saves.length === 0" style="flex-grow: 1" icon="map" :text="$t('save.hint')" />
        <v-layout v-else wrap row>
          <v-flex v-for="(s, index) of saves" :key="index" xs6>
            <save-view-page-preview-card :value="s" :delete-save="startDelete" :export-save="doExport" />
          </v-flex>
        </v-layout>
      </v-layout>
    </v-layout>
    <save-view-page-copy-from-dialog v-model="isCopyFromDialogShown" />
    <save-view-page-copy-to-dialog :value="copying" :operate="doCopy" :cancel="cancelCopy" :instances="instances" />
    <save-view-page-delete-dialog :value="deleting" :operate="doDelete" :cancel="cancelDelete" />
  </v-container>
</template>

<script lang="ts">
import { defineComponent, computed, ref } from '@vue/composition-api';
import {
  useInstanceSaves,
  useNativeDialog,
  useI18n,
  useInstances,
  useOperation,
  useDrop,
} from '@/hooks';
import SaveViewPageCopyFromDialog from './SaveViewPageCopyFromDialog.vue';
import SaveViewPageCopyToDialog from './SaveViewPageCopyToDialog.vue';
import SaveViewPageDeleteDialog from './SaveViewPageDeleteDialog.vue';
import SaveViewPagePreviewCard from './SaveViewPagePreviewCard.vue';

export default defineComponent({
  components: {
    SaveViewPageDeleteDialog,
    SaveViewPageCopyToDialog,
    SaveViewPageCopyFromDialog,
    SaveViewPagePreviewCard,
  },
  setup() {
    const { saves, deleteSave, importSave, exportSave, cloneSave: copySave } = useInstanceSaves();
    const { instances } = useInstances();
    const { showSaveDialog, showOpenDialog } = useNativeDialog();
    const { $t } = useI18n();
    const {
      data: deleting,
      operate: doDelete,
      begin: startDelete,
      cancel: cancelDelete,
    } = useOperation('', (save) => deleteSave({ saveName: save }));
    const {
      data: copying,
      begin: startCopy,
      operate: doCopy,
      cancel: cancelCopy,
    } = useOperation<string, string[]>('', (save, instances) => {
      copySave({ saveName: save, destInstancePath: instances });
    });
    const { onDrop } = useDrop((file) => importSave({ source: file.path }));
    const isCopyFromDialogShown = ref(false);
    return {
      saves,
      instances: computed(() => instances.value.map(i => i.path)),

      isCopyFromDialogShown,
      showCopyFromDialog() { isCopyFromDialogShown.value = true; },

      onDrop,

      deleting,
      startDelete,
      doDelete,
      cancelDelete,

      copying,
      startCopy,
      doCopy,
      cancelCopy,

      async doImport() {
        const { filePaths } = await showOpenDialog({
          title: $t('save.importTitle'),
          message: $t('save.importMessage'),
          filters: [{ extensions: ['zip'], name: 'zip' }],
        });
        for (const file of filePaths) {
          importSave({ source: file });
        }
      },
      async doExport(name: string) {
        const { filePath } = await showSaveDialog({
          title: $t('save.exportTitle'),
          message: $t('save.exportMessage'),
          filters: [{ extensions: ['zip'], name: 'zip' }],
        });
        if (filePath) {
          exportSave({ destination: filePath, zip: true, saveName: name });
        }
      },

    };
  },
});
</script>

<style>
</style>
