<template>
  <v-flex style="z-index: 1">
    <skin-view
      :href="url"
      :slim="slim"
      :rotate="false"
      @drop.prevent="dropSkin"
      @dragover.prevent
    />
    <speed-dial
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
        absolute
        style="bottom: 100px; z-index: 2;"
        :disabled="pending"
        @click="reset"
      >
        <v-icon>clear</v-icon>
      </v-btn>
    </v-fab-transition>
    <v-fab-transition>
      <v-btn
        v-show="modified"
        color="secondary"
        fab
        small
        absolute
        style="bottom: 100px; right: 177px; z-index: 2;"
        :disabled="pending"
        @click="save"
      >
        <v-icon>check</v-icon>
      </v-btn>
    </v-fab-transition>
    <v-dialog
      v-model="isImportSkinDialogShown"
      width="400"
    >
      <import-skin-url-form @input="url = $event" />
    </v-dialog>
  </v-flex>
</template>

<script lang=ts>
import { computed, defineComponent, ref } from '@vue/composition-api'
import {
  useI18n,
  useUserSkin,
  useNativeDialog,
  useUserSecurityStatus,
} from '/@/hooks'
import { required } from '/@/util/props'
import { useNotifier } from '../hooks'
import ImportSkinUrlForm from './UserPageImportSkinUrlForm.vue'
import SpeedDial from './UserPageSkinSpeedDial.vue'

export default defineComponent({
  components: {
    ImportSkinUrlForm,
    SpeedDial,
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
    const { showOpenDialog, showSaveDialog } = useNativeDialog()
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
