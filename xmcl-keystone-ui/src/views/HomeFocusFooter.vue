<template>
  <div class="w-full items-end flex">
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
      :issue="issue"
      :status="status"
      @pause="pause"
      @resume="resume"
    />
  </div>
</template>
<script lang="ts" setup>
import { useService } from '@/composables'
import { useDialog } from '@/composables/dialog'
import { kInstanceContext } from '@/composables/instanceContext'
import { AppExportDialogKey } from '@/composables/instanceExport'
import { injection } from '@/util/inject'
import { BaseServiceKey, InstanceServiceKey } from '@xmcl/runtime-api'
import HomeLaunchButton from './HomeLaunchButton.vue'
import HomeSettingsSpeedDial from './HomeSettingsSpeedDial.vue'

const { task, issue, refreshing } = injection(kInstanceContext)
const { state } = useService(InstanceServiceKey)
const { status, pause, resume } = task
const { openDirectory } = useService(BaseServiceKey)
const { show: showExport } = useDialog(AppExportDialogKey)
const { show: showLogDialog } = useDialog('log')
const { t } = useI18n()

function showInstanceFolder() {
  openDirectory(state.path)
}
</script>
