<template>
  <div class="flex flex-col max-h-full h-full px-8 py-4">
    <v-card
      class="flex py-1 rounded-lg flex-shrink flex-grow-0 items-center pr-2 gap-2 z-5 p-4"
      outlined
      elevation="1"
    >
      <v-card-title>{{ $tc('save.name', 2) }}</v-card-title>
      <v-spacer />
      <v-btn
        text
        @click="showCopyFromDialog"
      >
        <v-icon left>
          input
        </v-icon>
        {{ $t('save.copyFrom.title') }}
      </v-btn>
      <v-btn
        text
        @click="doImport"
      >
        <v-icon left>
          move_to_inbox
        </v-icon>
        {{ $t('save.import') }}
      </v-btn>
    </v-card>

    <v-container
      grid-list-md
      fill-height
      style="overflow: auto;"
      @dragover.prevent
      @drop="onDropSave"
    >
      <div class="flex flex-col h-full">
        <hint
          v-if="saves.length === 0"
          class="h-full"
          icon="map"
          :text="$t('save.dropHint')"
        />
        <transition-group
          tag="div"
          name="transition-list"
        >
          <save-view-page-preview-card
            v-for="s of saves"
            :key="s.path"
            :source="s"
            :delete-save="startDelete"
            :export-save="doExport"
            @dragstart="dragging = true"
            @dragend="dragging = false"
          />
        </transition-group>
      </div>
      <save-view-page-copy-from-dialog v-model="isCopyFromDialogShown" />
      <save-view-page-copy-to-dialog
        :value="copying"
        :operate="doCopy"
        :cancel="cancelCopy"
        :instances="instances"
      />
      <save-view-page-delete-dialog
        :value="deleting"
        :operate="doDelete"
        :cancel="cancelDelete"
      />
      <save-view-page-float-button
        :visible="dragging"
        @drop="deleting = $event.dataTransfer.getData('id')"
      />
    </v-container>
  </div>
</template>

<script lang="ts">
import { useI18n, useOperation, useDrop } from '/@/composables'
import Hint from '/@/components/Hint.vue'
import SaveViewPageCopyFromDialog from './SaveCopyFromDialog.vue'
import SaveViewPageCopyToDialog from './SaveCopyToDialog.vue'
import SaveViewPageDeleteDialog from './SaveDeleteDialog.vue'
import SaveViewPagePreviewCard from './SaveCard.vue'
import SaveViewPageFloatButton from './SaveFloatButton.vue'
import { useInstances } from '../composables/instance'
import { useInstanceSaves } from '../composables/save'

export default defineComponent({
  components: {
    SaveViewPageDeleteDialog,
    SaveViewPageCopyToDialog,
    SaveViewPageCopyFromDialog,
    SaveViewPagePreviewCard,
    SaveViewPageFloatButton,
    Hint,
  },
  setup() {
    const { saves, deleteSave, importSave, exportSave, cloneSave: copySave } = useInstanceSaves()
    const { instances } = useInstances()
    const { showSaveDialog, showOpenDialog } = windowController
    const { $t } = useI18n()
    const {
      data: deleting,
      operate: doDelete,
      begin: startDelete,
      cancel: cancelDelete,
    } = useOperation('', (save) => deleteSave({ saveName: save }))
    const {
      data: copying,
      begin: startCopy,
      operate: doCopy,
      cancel: cancelCopy,
    } = useOperation<string, string[]>('', (save, instances) => {
      copySave({ saveName: save, destInstancePath: instances })
    })
    const dragging = ref(false)
    const { onDrop } = useDrop((file) => importSave({ source: file.path }))
    const isCopyFromDialogShown = ref(false)
    function onDropSave(e: DragEvent) {
      if (!e.dataTransfer) return
      if (e.dataTransfer.files.length === 0) return
      for (let i = 0; i < e.dataTransfer.files.length; ++i) {
        importSave({ source: e.dataTransfer.files.item(i)!.path })
      }
    }

    return {
      saves,
      instances: computed(() => instances.value.map(i => i.path)),

      isCopyFromDialogShown,
      showCopyFromDialog() { isCopyFromDialogShown.value = true },

      onDrop,

      deleting,
      startDelete,
      doDelete,
      cancelDelete,

      copying,
      startCopy,
      doCopy,
      cancelCopy,

      dragging,

      onDropSave,

      async doImport() {
        const { filePaths } = await showOpenDialog({
          title: $t('save.importTitle'),
          message: $t('save.importMessage'),
          filters: [{ extensions: ['zip'], name: 'zip' }],
        })
        for (const file of filePaths) {
          importSave({ source: file })
        }
      },
      async doExport(name: string) {
        const { filePath } = await showSaveDialog({
          title: $t('save.exportTitle'),
          message: $t('save.exportMessage'),
          filters: [{ extensions: ['zip'], name: 'zip' }],
          defaultPath: `${name}.zip`,
        })
        if (filePath) {
          exportSave({ destination: filePath, zip: true, saveName: name })
        }
      },
    }
  },
})
</script>

<style>
</style>
