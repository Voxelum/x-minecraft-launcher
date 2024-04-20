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
          @remove="show(s.path)"
        />
      </TransitionGroup>
    </div>
    <!-- <SaveViewPageCopyFromDialog v-model="isCopyFromDialogShown" />
    <SaveViewPageCopyToDialog
      :value="copying"
      :operate="doCopy"
      :cancel="cancelCopy"
      :instances="instancePaths"
    /> -->
    <SimpleDialog
      v-model="model"
      :title="t('save.deleteTitle')"
      :width="500"
      persistent
      @confirm="doDelete()"
    >
      {{ t('save.deleteHint') }}
      <div style="color: grey">
        {{ deleting }}
      </div>
    </SimpleDialog>
  </div>
</template>

<script lang="ts" setup>
import Hint from '@/components/Hint.vue'
import { useDrop, useService } from '@/composables'
import { kInstances } from '@/composables/instances'
import { usePresence } from '@/composables/presence'
import { kInstanceSave } from '@/composables/save'
import { basename } from '@/util/basename'
import { injection } from '@/util/inject'
import { InstanceSavesServiceKey } from '@xmcl/runtime-api'
import SimpleDialog from '../components/SimpleDialog.vue'
import { useSimpleDialog } from '../composables/dialog'
import { kInstance } from '../composables/instance'
import SaveViewPagePreviewCard from './SaveCard.vue'
// import SaveViewPageCopyFromDialog from './SaveCopyFromDialog.vue'
// import SaveViewPageCopyToDialog from './SaveCopyToDialog.vue'
// import SaveViewPageFloatButton from './SaveFloatButton.vue'

const { path } = injection(kInstance)
const { saves } = injection(kInstanceSave)
const { instances } = injection(kInstances)

const { deleteSave, importSave, exportSave, cloneSave: copySave } = useService(InstanceSavesServiceKey)
const { showSaveDialog, showOpenDialog } = windowController
const { t } = useI18n()
// const { isShown: isCopyFromDialogShown } = useDialog('save-copy-from')
const { target: deleting, confirm: doDelete, model, show } = useSimpleDialog<string>((save) => deleteSave({ saveName: basename(save!), instancePath: path.value }))
// const {
//   data: copying,
//   begin: startCopy,
//   operate: doCopy,
//   cancel: cancelCopy,
// } = useOperation<string, string[]>('', (save, instances) => {
//   copySave({ saveName: save, destInstancePath: instances, srcInstancePath: path.value })
// })
const { onDrop } = useDrop((files) => {
  files.map(f => ({ path: f.path, instancePath: path.value })).forEach(importSave)
})
function onDropSave(e: DragEvent) {
  if (!e.dataTransfer) return
  if (e.dataTransfer.files.length === 0) return
  for (let i = 0; i < e.dataTransfer.files.length; ++i) {
    importSave({ path: e.dataTransfer.files.item(i)!.path, instancePath: path.value })
  }
}

const { name } = injection(kInstance)
usePresence(computed(() => t('presence.save', { instance: name.value })))

async function doImport() {
  const { filePaths } = await showOpenDialog({
    title: t('save.importTitle'),
    message: t('save.importMessage'),
    filters: [{ extensions: ['zip'], name: 'zip' }],
  })
  for (const file of filePaths) {
    importSave({ path: file, instancePath: path.value })
  }
}
async function doExport(name: string) {
  const { filePath } = await showSaveDialog({
    title: t('save.exportTitle'),
    message: t('save.exportMessage'),
    filters: [{ extensions: ['zip'], name: 'zip' }],
    defaultPath: `${name}.zip`,
  })
  if (filePath) {
    exportSave({ destination: filePath, zip: true, saveName: name, instancePath: path.value })
  }
}
const instancePaths = computed(() => instances.value.map(i => i.path))
// function showCopyFromDialog() { isCopyFromDialogShown.value = true }
</script>
