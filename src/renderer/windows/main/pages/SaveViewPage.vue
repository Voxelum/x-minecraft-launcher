<template>
  <v-container
    grid-list-md
    fill-height
    style="overflow: auto;"
    @dragover.prevent
    @drop="onDropSave"
  >
    <v-layout
      column
      fill-height
      style="max-height: 100%;"
    >
      <v-toolbar
        dark
        flat
        color="transparent"
      >
        <v-toolbar-title>{{ $tc('save.name', 2) }}</v-toolbar-title>
        <v-spacer />
        <v-btn
          flat
          @click="showCopyFromDialog"
        >
          <v-icon left>
            input
          </v-icon>
          {{ $t('save.copyFrom.title') }}
        </v-btn>
        <v-btn
          flat
          @click="doImport"
        >
          <v-icon left>
            move_to_inbox
          </v-icon>
          {{ $t('save.import') }}
        </v-btn>
      </v-toolbar>
      <v-flex
        d-flex
        xs12
        style="padding-right: 5px;"
      >
        <v-list
          class="list"
          style="overflow-y: auto; background: transparent;"
        >
          <hint
            v-if="saves.length === 0"
            style="flex-grow: 1; height: 100%;"
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
              @dragstart="dragging=true"
              @dragend="dragging=false"
            />
          </transition-group>
        </v-list>
      </v-flex>
    </v-layout>
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
</template>

<script lang="ts">
import { defineComponent, computed, ref } from '@vue/composition-api'
import {
  useInstanceSaves,
  useNativeDialog,
  useI18n,
  useInstances,
  useOperation,
  useDrop,
} from '/@/hooks'
import SaveViewPageCopyFromDialog from './SaveViewPageCopyFromDialog.vue'
import SaveViewPageCopyToDialog from './SaveViewPageCopyToDialog.vue'
import SaveViewPageDeleteDialog from './SaveViewPageDeleteDialog.vue'
import SaveViewPagePreviewCard from './SaveViewPagePreviewCard.vue'
import SaveViewPageFloatButton from './SaveViewPageFloatButton.vue'

export default defineComponent({
  components: {
    SaveViewPageDeleteDialog,
    SaveViewPageCopyToDialog,
    SaveViewPageCopyFromDialog,
    SaveViewPagePreviewCard,
    SaveViewPageFloatButton,
  },
  setup() {
    const { saves, deleteSave, importSave, exportSave, cloneSave: copySave } = useInstanceSaves()
    const { instances } = useInstances()
    const { showSaveDialog, showOpenDialog } = useNativeDialog()
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
