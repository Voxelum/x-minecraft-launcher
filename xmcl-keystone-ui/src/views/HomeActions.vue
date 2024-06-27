<template>
  <div
    v-if="!isFocus"
    class="grid grid-cols-4 gap-1"
  >
    <v-btn
      v-shared-tooltip="_ => t('modpack.export')"
      text
      icon
      :loading="isValidating"
      @click="showExport()"
    >
      <v-icon>
        share
      </v-icon>
    </v-btn>

    <v-btn
      v-shared-tooltip="_ => t('logsCrashes.title')"
      text
      icon
      :loading="isValidating"
      @click="showLogDialog()"
    >
      <v-icon>
        subtitles
      </v-icon>
    </v-btn>

    <v-btn
      v-shared-tooltip="_ => t('instance.showInstance')"
      text
      icon
      :loading="isValidating"
      @click="showInstanceFolder"
    >
      <v-icon>
        folder
      </v-icon>
    </v-btn>

    <v-btn
      v-shared-tooltip="_ => t('baseSetting.title', 2)"
      text
      icon
      :loading="isValidating"
      to="/base-setting"
    >
      <v-icon>
        tune
      </v-icon>
    </v-btn>
  </div>
</template>

<script lang=ts setup>
import { useService } from '@/composables'
import { kInstance } from '@/composables/instance'
import { useInFocusMode } from '@/composables/uiLayout'
import { vSharedTooltip } from '@/directives/sharedTooltip'
import { injection } from '@/util/inject'
import { BaseServiceKey } from '@xmcl/runtime-api'
import { useDialog } from '../composables/dialog'
import { AppExportDialogKey } from '../composables/instanceExport'
import { kInstances } from '@/composables/instances'

const isFocus = useInFocusMode()

const { path } = injection(kInstance)
const { isValidating } = injection(kInstances)
const { openDirectory } = useService(BaseServiceKey)
const { show: showLogDialog } = useDialog('log')
const { show: showExport } = useDialog(AppExportDialogKey)
const { t } = useI18n()

function showInstanceFolder() {
  openDirectory(path.value)
}

</script>
<style scoped>
.compact {
  background: rgba(0, 0, 0, 0.5);
}

</style>
