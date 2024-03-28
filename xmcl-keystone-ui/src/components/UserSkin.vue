<template>
  <div
    class="relative flex flex-col items-center justify-center gap-2"
    @mouseenter="hover = true"
    @mouseleave="hover = false"
  >
    <div class="absolute top-4 flex flex-none flex-shrink gap-4">
      <v-fab-transition>
        <v-btn
          v-if="inspect && modified"
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
    </div>
    <SkinView
      :paused="paused"
      :skin="skin"
      :slim="inferModelType ? undefined : slim"
      :cape="cape"
      :name="name"
      :animation="hover ? 'running' : selected ? 'walking' : 'idle'"
      @model="onModelChange"
      @drop.prevent="dropSkin"
      @dragover.prevent="() => { }"
    />
    <div class="absolute bottom-4 flex flex-none flex-shrink gap-4">
      <v-fab-transition>
        <v-btn
          v-show="!inspect && modified"
          v-shared-tooltip="_ => t('userSkin.reset')"
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
      <SpeedDial
        :value="hover || modified"
        :has-skin="canUploadSkin"
        :has-cape="canUploadCape"
        :disabled="pending"
        :upload="() => isImportSkinDialogShown = true"
        :save="exportSkin"
        :load="loadSkin"
      />
      <v-fab-transition>
        <v-btn
          v-show="!inspect && modified"
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
      <ImportSkinUrlForm @input="skin = $event" />
    </v-dialog>
  </div>
</template>

<script lang=ts setup>
import SkinView from '@/components/SkinView.vue'
import { vSharedTooltip } from '@/directives/sharedTooltip'
import { GameProfileAndTexture, UserProfile } from '@xmcl/runtime-api'
import { useNotifier } from '../composables/notifier'
import { PlayerNameModel, UserSkinModel, UserSkinRenderPaused, usePlayerName, useUserSkin } from '../composables/userSkin'
import ImportSkinUrlForm from './UserSkinImportUrlForm.vue'
import SpeedDial from './UserSkinSpeedDial.vue'

const props = withDefaults(defineProps<{
  user: UserProfile
  profile: GameProfileAndTexture
  inspect: boolean
}>(), { inspect: false })
const { t } = useI18n()
const hover = ref(false)
const { watcherTask } = useNotifier()

const gameProfile = computed(() => props.profile)
const selected = computed(() => props.user.selectedProfile === props.profile.id)
const name = inject(PlayerNameModel, () => usePlayerName(gameProfile), true)

const { skin, slim, save, exportTo, loading, modified, reset, inferModelType, cape, canUploadCape, canUploadSkin } = inject(UserSkinModel, () => useUserSkin(computed(() => props.user.id), gameProfile), true)
const paused = inject(UserSkinRenderPaused, () => ref(false), true)
const pending = computed(() => loading.value)
const { showOpenDialog, showSaveDialog } = windowController
const isImportSkinDialogShown = ref(false)

const onModelChange = (modelType: 'default' | 'slim') => {
  if (inferModelType.value) {
    console.log('infer model ' + modelType)
    slim.value = modelType !== 'default'
    inferModelType.value = false
  }
}

async function loadSkin() {
  if (!canUploadSkin.value) return
  const { filePaths } = await showOpenDialog({ title: t('userSkin.importFile'), filters: [{ extensions: ['png'], name: 'PNG Images' }] })
  if (filePaths && filePaths[0]) {
    skin.value = `http://launcher/media?path=${filePaths[0]}`
    inferModelType.value = true
  }
}
async function exportSkin() {
  const { filePath } = await showSaveDialog({
    title: t('userSkin.saveTitle'),
    defaultPath: `${name.value}.png`,
    filters: [{ extensions: ['png'], name: 'PNG Images' }],
  })
  if (filePath) {
    exportTo({ path: filePath, url: skin.value })
  }
}
async function dropSkin(e: DragEvent) {
  if (!canUploadSkin.value) return
  if (e.dataTransfer) {
    const length = e.dataTransfer.files.length
    if (length > 0) {
      skin.value = `http://launcher/media?path=${e.dataTransfer!.files[0].path}`
      inferModelType.value = true
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
