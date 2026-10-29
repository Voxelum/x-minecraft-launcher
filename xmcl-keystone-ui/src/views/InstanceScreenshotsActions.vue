<template>
  <div
    v-roving-tabindex
    role="toolbar"
    aria-orientation="horizontal"
    :aria-label="t('screenshots.title')"
    class="flex items-center justify-end gap-2"
  >
    <v-btn
      v-shared-tooltip.bottom="() => t('screenshots.import')"
      icon
      variant="text"
      density="comfortable"
      :aria-label="t('screenshots.import')"
      @click="onPickImport"
    >
      <v-icon>add_photo_alternate</v-icon>
    </v-btn>

    <v-btn
      v-shared-tooltip.bottom="() => t('screenshots.openFolder')"
      icon
      variant="text"
      density="comfortable"
      :aria-label="t('screenshots.openFolder')"
      @click="onOpenFolder"
    >
      <v-icon>folder</v-icon>
    </v-btn>

    <v-btn
      v-shared-tooltip.bottom="() => t('screenshots.backToHome')"
      icon
      variant="text"
      density="comfortable"
      to="/"
    >
      <v-icon>arrow_back</v-icon>
    </v-btn>
  </div>
</template>

<script lang="ts" setup>
import { useService } from '@/composables/service'
import { kInstance } from '@/composables/instance'
import { vRovingTabindex } from '@/directives/rovingTabindex'
import { vSharedTooltip } from '@/directives/sharedTooltip'
import { injection } from '@/util/inject'
import { BaseServiceKey } from '@xmcl/runtime-api'
import { useScreenshotManagerContext } from '@/composables/screenshotManager'

const { path: instancePath } = injection(kInstance)
const { openDirectory } = useService(BaseServiceKey)
const { t } = useI18n()
const { importFiles } = useScreenshotManagerContext()

function onOpenFolder() {
  const screenshotsPath = `${instancePath.value}/screenshots`
  openDirectory(screenshotsPath)
}

async function onPickImport() {
  const result = await windowController.showOpenDialog({
    title: t('screenshots.import'),
    properties: ['openFile', 'multiSelections'],
    filters: [
      {
        name: t('screenshots.images'),
        extensions: ['png', 'jpg', 'jpeg', 'webp', 'gif', 'bmp'],
      },
    ],
  })
  if (!result.canceled && result.filePaths.length > 0) {
    await importFiles(result.filePaths)
  }
}
</script>
