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
      @click="showExport"
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
      @click="showLogDialog"
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
import { kInstanceContext } from '@/composables/instanceContext'
import { kCompact } from '@/composables/scrollTop'
import { vSharedTooltip } from '@/directives/sharedTooltip'
import { injection } from '@/util/inject'
import { BaseServiceKey, VersionServiceKey } from '@xmcl/runtime-api'
import { useDialog } from '../composables/dialog'
import { AppExportDialogKey } from '../composables/instanceExport'
import { useInFocusMode } from '@/composables/uiLayout'

const isFocus = useInFocusMode()

const { path, refreshing, name, version, localVersion } = injection(kInstanceContext)
const { openDirectory } = useService(BaseServiceKey)
const { show: showLogDialog } = useDialog('log')
const { show: showExport } = useDialog(AppExportDialogKey)
const { t } = useI18n()
const { showVersionDirectory } = useService(VersionServiceKey)

const currentVersion = computed(() => !localVersion.value.id ? t('version.notInstalled') : localVersion.value.id)
const scrollTop = injection(kCompact)
const compact = computed(() => scrollTop.value)
const headerFontSize = computed(() => {
  if (compact.value) {
    return '1.8rem'
  }
  if (name.value && name.value.length > 30) {
    return '2rem'
  }
  return '2.425rem'
})

const onShowLocalVersion = () => {
  if (localVersion.value.id) {
    showVersionDirectory(localVersion.value.id)
  }
}

function showInstanceFolder() {
  openDirectory(path.value)
}

</script>
<style scoped>
.compact {
  background: rgba(0, 0, 0, 0.5);
}

</style>
