<template>
  <div class="flex flex-col items-center justify-center">
    <skin-view
      :href="url"
      :slim="slim"
      :rotate="false"
      @drop.prevent="dropSkin"
      @dragover.prevent="() => {}"
    />
    <div class="flex flex-shrink gap-4 flex-none">
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
        class=""
        :security="true"
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
          @click="save"
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

<script lang=ts>
import { useI18n } from '/@/composables'
import { required } from '/@/util/props'
import ImportSkinUrlForm from './UserImportSkinUrlForm.vue'
import SpeedDial from './UserSkinSpeedDial.vue'
import SkinView from '/@/components/SkinView.vue'
import { useNotifier } from '../composables/notifier'
import { useUserSecurityStatus, useUserSkin } from '../composables/user'

export default defineComponent({
  components: {
    ImportSkinUrlForm,
    SpeedDial,
    SkinView,
  },
  props: {
    userId: required<string>(String),
    profileId: required<string>(String),
    name: required<string>(String),
  },
  setup(props) {
    const { $t } = useI18n()
    const { watcherTask } = useNotifier()
    const { security } = useUserSecurityStatus()
    const { url, slim, refreshing, refresh, save, exportTo, loading, modified, reset } = useUserSkin(computed(() => props.userId), computed(() => props.profileId))
    const { showOpenDialog, showSaveDialog } = windowController
    const isImportSkinDialogShown = ref(false)
    const pending = computed(() => refreshing.value || loading.value)
    async function loadSkin() {
      const { filePaths } = await showOpenDialog({ title: $t('user.skinImportFile'), filters: [{ extensions: ['png'], name: 'PNG Images' }] })
      if (filePaths && filePaths[0]) {
        url.value = `image://${filePaths[0]}`
      }
    }
    async function exportSkin() {
      const { filePath } = await showSaveDialog({
        title: $t('user.skinSaveTitle'),
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
    return {
      url,
      slim,
      modified,
      reset,
      refresh: watcherTask(async () => refresh(), $t('user.refreshSkin')),
      save: watcherTask(save, $t('skin.upload')),
      pending,
      security,
      loadSkin,
      exportSkin,
      dropSkin,
      isImportSkinDialogShown,
    }
  },
})
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
