<template>
  <div
    v-if="!isFocus"
    class=""
  >
    <v-btn
      v-shared-tooltip="t('modpack.export')"
      text
      icon
      :loading="refreshing"
      @click="showExport()"
    >
      <v-icon>
        share
      </v-icon>
    </v-btn>

    <v-btn
      v-shared-tooltip="t('logsCrashes.title')"
      class="ml-1.5"
      text
      icon
      @click="showLogDialog()"
    >
      <v-icon>
        subtitles
      </v-icon>
    </v-btn>

    <v-btn
      v-shared-tooltip="t('instance.showInstance')"
      class="ml-1.5"
      text
      icon
      @click="showInstanceFolder"
    >
      <v-icon>
        folder
      </v-icon>
    </v-btn>

    <v-btn
      v-shared-tooltip="t('baseSetting.title', 2)"
      class="ml-1.5"
      text
      icon
      to="/base-setting"
    >
      <v-icon>
        settings
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

const isFocus = useInFocusMode()

const { path, refreshing } = injection(kInstance)
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
