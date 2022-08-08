<template>
  <div
    class="flex flex-col items-center justify-center gap-4"
    @mouseenter="hover = true"
    @mouseleave="hover = false"
  >
    <skin-view
      class="border rounded"
      :href="url"
      :slim="slim"
      :rotate="false"
      @drop.prevent="dropSkin"
      @dragover.prevent="() => { }"
    />
    <div class="flex flex-shrink gap-4 flex-none absolute bottom-4">
      <v-fab-transition>
        <v-btn
          v-show="modified"
          color="secondary"
          fab
          small
          style="z-index: 3;"
          :disabled="pending"
          @click="reset"
        >
          <v-icon>clear</v-icon>
        </v-btn>
      </v-fab-transition>
      <speed-dial
        :value="hover"
        :disabled="pending"
        :upload="() => isImportSkinDialogShown = true"
        :save="exportSkin"
        :load="loadSkin"
      />
      <v-fab-transition>
        <v-btn
          v-show="modified"
          color="secondary"
          fab
          small
          style="z-index: 3;"
          :disabled="pending"
          @click="save_"
        >
          <v-icon>check</v-icon>
        </v-btn>
      </v-fab-transition>
    </div>
    <v-dialog
      v-model="isImportSkinDialogShown"
      width="400"
    >
      <import-skin-url-form @input="url = $event" />
    </v-dialog>
  </div>
</template>

<script lang=ts setup>
import { useNotifier } from '../composables/notifier'
import { useUserSkin } from '../composables/user'
import ImportSkinUrlForm from './UserImportSkinUrlForm.vue'
import SpeedDial from './UserSkinSpeedDial.vue'
import SkinView from '/@/components/SkinView.vue'
import { useI18n } from '/@/composables'

const props = defineProps<{
  userId: string
  profileId: string
  name: string
  slim: boolean
}>()
const { t } = useI18n()
const hover = ref(false)
const { watcherTask } = useNotifier()
const { url, refreshing, refresh, save, exportTo, loading, modified, reset } = useUserSkin(computed(() => props.userId), computed(() => props.profileId))
const { showOpenDialog, showSaveDialog } = windowController
const isImportSkinDialogShown = ref(false)
const pending = computed(() => refreshing.value || loading.value)
async function loadSkin() {
  const { filePaths } = await showOpenDialog({ title: t('userSkin.importFile'), filters: [{ extensions: ['png'], name: 'PNG Images' }] })
  if (filePaths && filePaths[0]) {
    url.value = `image://${filePaths[0]}`
  }
}
async function exportSkin() {
  const { filePath } = await showSaveDialog({
    title: t('userSkin.saveTitle'),
    defaultPath: `${props.name}.png`,
    filters: [{ extensions: ['png'], name: 'PNG Images' }],
  })
  if (filePath) {
    exportTo({ path: filePath, url: url.value })
  }
}
async function dropSkin(e: DragEvent) {
  if (e.dataTransfer) {
    const length = e.dataTransfer.files.length
    if (length > 0) {
      url.value = `image://${e.dataTransfer!.files[0].path}`
    }
  }
}

const save_ = watcherTask(save, t('userSkin.upload'))

</script>

<style>
.my-slider-x-transition-enter-active {
  transition: 0.3 cubic-bezier(0.25, 0.8, 0.5, 1);
}

.my-slider-x-transition-leave-active {
  transition: 0.3 cubic-bezier(0.25, 0.8, 0.5, 1);
}

.my-slider-x-transition-move {
  transition: transform 0.6s;
}

.my-slider-x-transition-enter {
  transform: translateX(100%);
}

.my-slider-x-transition-leave-to {
  transform: translateX(100%);
}
</style>
