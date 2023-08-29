<template>
  <div class="flex w-full items-end">
    <div>
      <HomeSettingsSpeedDial :refreshing="false" />
    </div>
    <v-tooltip
      top
      transition="scroll-y-reverse-transition"
    >
      <template #activator="{ on }">
        <v-btn
          text
          icon
          v-on="on"
          @click="showInstanceFolder"
        >
          <v-icon>
            folder
          </v-icon>
        </v-btn>
      </template>
      {{ t("instance.showInstance") }}
    </v-tooltip>

    <v-tooltip
      top
      transition="scroll-y-reverse-transition"
    >
      <template #activator="{ on }">
        <v-btn
          text
          icon
          v-on="on"
          @click="showLogDialog"
        >
          <v-icon>
            subtitles
          </v-icon>
        </v-btn>
      </template>
      {{ t("logsCrashes.title") }}
    </v-tooltip>
    <v-tooltip
      :close-delay="0"
      top
      transition="scroll-y-reverse-transition"
    >
      <template #activator="{ on }">
        <v-btn
          text
          icon
          :loading="refreshing"
          v-on="on"
          @click="showExport"
        >
          <v-icon>
            share
          </v-icon>
        </v-btn>
      </template>
      {{ t('modpack.export') }}
    </v-tooltip>

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
import HomeSettingsSpeedDial from './HomeSettingsSpeedDial.vue'

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
