<template>
  <div class="flex w-full items-end">
    <v-btn
      v-shared-tooltip="_ => t('baseSetting.title')"
      text
      icon
      to="/base-setting"
      :loading="refreshing"
    >
      <v-icon>
        tune
      </v-icon>
    </v-btn>
    <v-btn
      v-shared-tooltip="_ => t('instance.showInstance')"
      text
      icon
      @click="showInstanceFolder"
    >
      <v-icon>
        folder
      </v-icon>
    </v-btn>

    <v-btn
      v-shared-tooltip="_ => t('logsCrashes.title')"
      text
      icon
      @click="showLogDialog"
    >
      <v-icon>
        subtitles
      </v-icon>
    </v-btn>
    <v-btn
      v-shared-tooltip="_ => t('modpack.export')"
      text
      icon
      :loading="refreshing"
      @click="showExport"
    >
      <v-icon>
        share
      </v-icon>
    </v-btn>

    <v-spacer />
    <HomeLaunchButton
      class="ml-4"
      :status="status"
      @pause="pause"
      @resume="resume"
    />
  </div>
</template>
<script lang="ts" setup>
import { useService } from '@/composables'
import { useDialog } from '@/composables/dialog'
import { kInstance } from '@/composables/instance'
import { AppExportDialogKey } from '@/composables/instanceExport'
import { kLaunchTask } from '@/composables/launchTask'
import { injection } from '@/util/inject'
import { BaseServiceKey } from '@xmcl/runtime-api'
import HomeLaunchButton from './HomeLaunchButton.vue'
import { vSharedTooltip } from '@/directives/sharedTooltip'

const { path, refreshing } = injection(kInstance)
const { status, pause, resume } = injection(kLaunchTask)
const { openDirectory } = useService(BaseServiceKey)
const { show: showExport } = useDialog(AppExportDialogKey)
const { show: showLogDialog } = useDialog('log')
const { t } = useI18n()

function showInstanceFolder() {
  openDirectory(path.value)
}
</script>
