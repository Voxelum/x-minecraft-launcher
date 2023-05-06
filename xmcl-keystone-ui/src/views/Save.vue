<template>
  <div
    class="flex flex-col px-8"
    @dragover.prevent
    @drop="onDropSave"
  >
    <div class="flex flex-col">
      <Hint
        v-if="saves.length === 0"
        icon="map"
        :text="t('save.dropHint')"
      />
      <TransitionGroup
        tag="div"
        name="transition-list"
      >
        <SaveViewPagePreviewCard
          v-for="s of saves"
          :key="s.path"
          :source="s"
          :export-save="doExport"
          @dragstart="dragging = true"
          @dragend="dragging = false"
          @remove="onStartDelete(s.path)"
        />
      </TransitionGroup>
    </div>
    <SaveViewPageCopyFromDialog v-model="isCopyFromDialogShown" />
    <SaveViewPageCopyToDialog
      :value="copying"
      :operate="doCopy"
      :cancel="cancelCopy"
      :instances="instances"
    />
    <DeleteDialog
      :title="t('save.deleteTitle')"
      :width="500"
      persistent
      @confirm="doDelete"
      @cancel="cancelDelete"
    >
      {{ t('save.deleteHint') }}
      <div style="color: grey">
        {{ deleting }}
      </div>
    </DeleteDialog>
    <SaveViewPageFloatButton
      :visible="dragging"
      @drop="$event.dataTransfer ? onStartDelete($event.dataTransfer.getData('id')) : ''"
    />
  </div>
</template>

<script lang="ts">
import Hint from '@/components/Hint.vue'
import { useDrop, useOperation } from '@/composables'
import { kInstanceContext } from '@/composables/instanceContext'
import { usePresence } from '@/composables/presence'
import { injection } from '@/util/inject'
import DeleteDialog from '../components/DeleteDialog.vue'
import { useDialog } from '../composables/dialog'
import { useInstances } from '../composables/instance'
import { useInstanceSaves } from '../composables/save'
import SaveViewPagePreviewCard from './SaveCard.vue'
import SaveViewPageCopyFromDialog from './SaveCopyFromDialog.vue'
import SaveViewPageCopyToDialog from './SaveCopyToDialog.vue'
import SaveViewPageFloatButton from './SaveFloatButton.vue'

export default defineComponent({
  components: {
    SaveViewPageCopyToDialog,
    SaveViewPageCopyFromDialog,
    SaveViewPagePreviewCard,
    SaveViewPageFloatButton,
    Hint,
    DeleteDialog,
  },
  setup() {
    const { saves, deleteSave, importSave, exportSave, cloneSave: copySave } = useInstanceSaves()
    const { instances } = useInstances()
    const { showSaveDialog, showOpenDialog } = windowController
    const { t } = useI18n()
    const { isShown: isCopyFromDialogShown } = useDialog('save-copy-from')
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
    const { onDrop } = useDrop((files) => {
      files.map(f => ({ path: f.path })).forEach(importSave)
    })
    function onDropSave(e: DragEvent) {
      if (!e.dataTransfer) return
      if (e.dataTransfer.files.length === 0) return
      for (let i = 0; i < e.dataTransfer.files.length; ++i) {
        importSave({ path: e.dataTransfer.files.item(i)!.path })
      }
    }
    const { show } = useDialog('deletion')
    function onStartDelete(id: string) {
      deleting.value = id
      show()
    }

    const { name } = injection(kInstanceContext)
    usePresence(computed(() => t('presence.save', { instance: name.value })))

    return {
      saves,
      t,
      onStartDelete,
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
          title: t('save.importTitle'),
          message: t('save.importMessage'),
          filters: [{ extensions: ['zip'], name: 'zip' }],
        })
        for (const file of filePaths) {
          importSave({ path: file })
        }
      },
      async doExport(name: string) {
        const { filePath } = await showSaveDialog({
          title: t('save.exportTitle'),
          message: t('save.exportMessage'),
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
