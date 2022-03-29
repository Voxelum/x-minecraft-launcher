<template>
  <v-tooltip
    :close-delay="0"
    left
  >
    <template #activator="{ on }">
      <v-speed-dial
        open-on-hover
        direction="bottom"
        transition="slide-y-reverse-transition"
      >
        <template #activator>
          <v-btn
            text
            fab
            :loading="loading"
            small
            @click="onImport('folder')"
            v-on="on"
          >
            <v-icon
              style="font-size: 28px"
            >
              save_alt
            </v-icon>
          </v-btn>
        </template>

        <!-- <v-btn
          fab
          small
          @click="onImport('zip')"
        >
          <v-tooltip
            :close-delay="0"
            left
          >
            <template #activator="{ on: tooltip }">
              <v-icon
                v-on="tooltip"
              >
                folder_zip
              </v-icon>
            </template>
            {{ t('profile.importZip') }}
          </v-tooltip>
        </v-btn> -->
      </v-speed-dial>
    </template>
    {{ t('profile.importFolder') }}
  </v-tooltip>
</template>

<script lang=ts setup>
import { InstanceServiceKey } from '@xmcl/runtime-api'
import { useBusy, useI18n, useService } from '/@/composables'

const { showOpenDialog } = windowController
const { t } = useI18n()
const { addExternalInstance } = useService(InstanceServiceKey)
const loading = useBusy('addExternalInstance()')

async function onImport(type: 'zip' | 'folder') {
  const fromFolder = type === 'folder'
  const filters = fromFolder
    ? []
    : [{ extensions: ['zip'], name: 'Zip' }]
  const { filePaths } = await showOpenDialog({
    title: t('profile.import.title'),
    message: t('profile.import.description'),
    filters,
    properties: fromFolder ? ['openDirectory'] : ['openFile'],
  })
  if (filePaths && filePaths.length > 0) {
    const filePath = filePaths[0]
    if (type === 'folder') {
      addExternalInstance(filePath)
    } else {
      // await importInstance(f)
    }
  }
}

</script>

<style>
</style>
