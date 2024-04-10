<template>
  <div class="h-full overflow-auto">
    <v-list
      nav
      dense
      class="ml-1 flex-grow-0 justify-start overflow-auto px-2"
    >
      <template v-if="isValidating">
        <v-skeleton-loader
          v-for="i in 5"
          :key="i"
          class="non-moveable my-2 ml-[6px]"
          type="avatar"
        />
      </template>
      <AppSideBarInstanceItem
        v-for="(i, index) of instances"
        :key="i.path + ' ' + index"
        :instance="i"
        @drop="setToPrevious($event, i.path)"
        @drop-save="onCopySave"
      />

      <v-list-item
        push
        class="non-moveable"
        @click="showAddInstance()"
      >
        <v-tooltip
          :close-delay="0"
          color="black"
          transition="scroll-x-transition"
          right
        >
          <template #activator="{ on: tooltip }">
            <v-list-item-avatar
              id="create-instance-button"
              size="48"
              class="bg-[rgba(80,80,80,0.4)] transition-all duration-300 hover:rounded-xl hover:bg-green-500"
              large
              v-on="tooltip"
            >
              <v-icon class="text-3xl">
                add
              </v-icon>
            </v-list-item-avatar>
          </template>
          {{ t('instances.add') }}
        </v-tooltip>

        <v-list-item-title>Instance</v-list-item-title>
      </v-list-item>
      <v-spacer />
    </v-list>
    <DeleteDialog
      :width="500"
      color="primary"
      dialog="saveCopyDialog"
      :title="t('save.copy.title')"
      :confirm="t('save.copy.confirm')"
      @confirm="doCopy"
    >
      {{ copySavePayload?.destInstancePath }}
      {{ copySavePayload?.saveName }}
    </DeleteDialog>
  </div>
</template>
<script setup lang="ts">
import DeleteDialog from '@/components/DeleteDialog.vue'
import { useService } from '@/composables'
import { useDialog } from '@/composables/dialog'
import { AddInstanceDialogKey } from '@/composables/instanceTemplates'
import { kInstances } from '@/composables/instances'
import { basename, dirname } from '@/util/basename'
import { injection } from '@/util/inject'
import { InstanceSavesServiceKey, InstanceServiceKey } from '@xmcl/runtime-api'
import AppSideBarInstanceItem from './AppSideBarInstanceItem.vue'
import { useNotifier } from '@/composables/notifier'

const { t } = useI18n()

const { instances, setToPrevious, isValidating, selectedInstance } = injection(kInstances)
const { showOpenDialog } = windowController
const { addExternalInstance } = useService(InstanceServiceKey)

async function onImport(type: 'zip' | 'folder') {
  const fromFolder = type === 'folder'
  const filters = fromFolder
    ? []
    : [{ extensions: ['zip'], name: 'Zip' }]
  const { filePaths } = await showOpenDialog({
    title: t('instances.importFolder'),
    message: t('instances.importFolderDescription'),
    filters,
    properties: fromFolder ? ['openDirectory'] : ['openFile'],
  })
  if (filePaths && filePaths.length > 0) {
    const filePath = filePaths[0]
    if (type === 'folder') {
      addExternalInstance(filePath)
    }
  }
}

const { show: showAddInstance } = useDialog(AddInstanceDialogKey)

const { isShown } = useDialog('saveCopyDialog')
const copySavePayload = ref(undefined as {
  saveName: string
  srcInstancePath: string
  destInstancePath: string
} | undefined)
function onCopySave(instancePath: string, save: string) {
  if (selectedInstance.value === instancePath) {
    return
  }
  const savePath = save
  const saveName = basename(savePath)
  const srcInstancePath = dirname(savePath)
  const destInstancePath = instancePath
  copySavePayload.value = { saveName, srcInstancePath, destInstancePath }
  isShown.value = true
}
const { cloneSave } = useService(InstanceSavesServiceKey)
const { notify } = useNotifier()
function doCopy() {
  if (copySavePayload.value) {
    cloneSave({ ...copySavePayload.value }).then(() => {
      notify({
        level: 'success',
        title: t('save.copy.name'),
      })
    }, () => {
      notify({
        level: 'error',
        title: t('save.copy.name'),
      })
    })
  }
  isShown.value = false
}

</script>
