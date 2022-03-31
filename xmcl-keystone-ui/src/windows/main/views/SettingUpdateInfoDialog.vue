<template>
  <v-dialog
    v-model="isShown"
    width="800"
    @input="$emit('input', $event)"
  >
    <v-card
      v-if="updateInfo"
      outlined
      class="overflow-auto visible-scroll max-h-90vh"
    >
      <v-card-title>
        {{ updateInfo.name }}
      </v-card-title>
      <v-card-subtitle>
        {{ new Date(updateInfo.date).toLocaleDateString() }}
      </v-card-subtitle>
      <v-card-text>
        <div v-html="body" />
      </v-card-text>
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
          {{ $t('setting.officialWebsite') }}
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
          {{ $t('setting.githubRelease') }}
        </v-btn>
        <v-spacer />
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
          {{ $t('setting.updateToThisVersion') }}
        </v-btn>
        <v-btn
          v-else
          color="primary"
          @click="quitAndInstall()"
        >
          <v-icon
            left
          >
            refresh
          </v-icon>
          {{ $t('setting.installAndQuit') }}
        </v-btn>
      </v-card-actions>
    </v-card>
    <v-card
      v-else
      hover

      style="width: 100%"
      to="https://github.com/voxelum/x-minecraft-launcher/releases"
      push
    >
      <v-container fill-height>
        <v-layout
          fill-height
          justify-space-around
          align-center
        >
          <h3 v-if="!checkingUpdate">
            {{ $t('setting.noUpdateAvailable') }}
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
import { useBusy, useService } from '/@/composables'
import MarkdownIt from 'markdown-it'
import { BaseServiceKey } from '@xmcl/runtime-api'
import { useDialog } from '../composables/dialog'

const { isShown } = useDialog('update-info')
const renderer = new MarkdownIt()
const { state, openInBrowser, checkUpdate, downloadUpdate, quitAndInstall } = useService(BaseServiceKey)
const checkingUpdate = useBusy('checkUpdate()')
const downloadingUpdate = useBusy('downloadUpdate()')
const updateInfo = computed(() => state.updateInfo)
const updateStatus = computed(() => state.updateStatus)
const body = computed(() => state.updateInfo?.useAutoUpdater ? state.updateInfo.body : renderer.render(state.updateInfo?.body ?? ''))
const canAutoUpdate = computed(() => state.env === 'raw')
const openOfficialWebsite = () => {
  openInBrowser('https://xmcl.app')
}
const openGithub = () => {
  openInBrowser('https://github.com/voxelum/x-minecraft-launcher/releases')
}
</script>

<style>
</style>
