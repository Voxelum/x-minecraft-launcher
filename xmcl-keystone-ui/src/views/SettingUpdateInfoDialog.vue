<template>
  <v-dialog
    v-model="isShown"
    width="800"
    @input="$emit('input', $event)"
  >
    <v-card
      v-if="updateInfo"
      outlined
      class="visible-scroll max-h-90vh overflow-auto"
    >
      <v-alert
        v-if="isAppX"
        text
        type="warning"
      >
        {{ t('setting.appxUpdateHint') }}
      </v-alert>
      <v-card-title>
        {{ updateInfo.name }}
      </v-card-title>
      <v-card-subtitle>
        {{ getLocalDateString(updateInfo.date) }}
      </v-card-subtitle>
      <v-card-text class="markdown-body">
        <div v-html="body" />
      </v-card-text>
      <v-alert
        v-if="hintRedownload"
        text
        type="warning"
      >
        {{ t('setting.maunalUpdateHint') }}
      </v-alert>
      <v-card-actions>
        <v-btn
          text
          @click="openOfficialWebsite()"
        >
          <v-icon
            left
          >
            web
          </v-icon>
          {{ t('setting.officialWebsite') }}
        </v-btn>
        <v-btn
          text
          @click="openGithub()"
        >
          <v-icon
            left
          >
            signpost
          </v-icon>
          {{ t('setting.githubRelease') }}
        </v-btn>
        <v-spacer />
        <template v-if="!hintRedownload">
          <v-btn
            v-if="updateStatus === 'pending'"
            color="primary"
            text
            :loading="downloadingUpdate"
            :disabled="downloadingUpdate"
            @click="downloadUpdate()"
          >
            <v-icon
              left
            >
              cloud_download
            </v-icon>
            {{ t('launcherUpdate.updateToThisVersion') }}
          </v-btn>
          <v-btn
            v-else
            color="primary"
            :loading="installing"
            @click="quitAndInstall()"
          >
            <v-icon
              left
            >
              refresh
            </v-icon>
            {{ t('launcherUpdate.installAndQuit') }}
          </v-btn>
        </template>
      </v-card-actions>
    </v-card>
    <v-card
      v-else
      hover

      style="width: 100%"
      to="https://github.com/voxelum/x-minecraft-launcher/releases"
      target="browser"
      push
    >
      <v-container fill-height>
        <v-layout
          fill-height
          justify-space-around
          align-center
        >
          <h3 v-if="!checkingUpdate">
            {{ t('launcherUpdate.noUpdateAvailable') }}
          </h3>
          <v-progress-circular
            v-else
            indeterminate
          />
        </v-layout>
      </v-container>
    </v-card>
  </v-dialog>
</template>

<script lang=ts setup>
import { useService, useServiceBusy } from '@/composables'
import { useEnvironment } from '@/composables/environment'
import { useMarkdown } from '@/composables/markdown'
import { kSettingsState } from '@/composables/setting'
import { getLocalDateString } from '@/util/date'
import { injection } from '@/util/inject'
import { BaseServiceKey } from '@xmcl/runtime-api'
import { useDialog } from '../composables/dialog'

const { isShown } = useDialog('update-info')
const { t } = useI18n()
const { render } = useMarkdown()
const installing = useServiceBusy(BaseServiceKey, 'quitAndInstall')
const { downloadUpdate, quitAndInstall } = useService(BaseServiceKey)
const checkingUpdate = useServiceBusy(BaseServiceKey, 'checkUpdate')
const downloadingUpdate = useServiceBusy(BaseServiceKey, 'downloadUpdate')
const { state } = injection(kSettingsState)
const updateInfo = computed(() => state.value?.updateInfo)
const updateStatus = computed(() => state.value?.updateStatus)
const body = computed(() => state.value?.updateInfo?.useAutoUpdater ? state.value?.updateInfo.body : render(state.value?.updateInfo?.body ?? ''))
const env = useEnvironment()
const isAppX = computed(() => env.value?.env === 'appx')
const isAppImage = computed(() => env.value?.env === 'appimage')
const hintRedownload = computed(() =>
  !isAppX.value &&
  !isAppImage.value &&
  !updateInfo.value?.useAutoUpdater &&
  !updateInfo.value?.incremental,
)

const openOfficialWebsite = () => {
  window.open('https://xmcl.app', 'browser')
}
const openGithub = () => {
  window.open('https://github.com/voxelum/x-minecraft-launcher/releases', 'browser')
}
</script>

<style>
</style>
