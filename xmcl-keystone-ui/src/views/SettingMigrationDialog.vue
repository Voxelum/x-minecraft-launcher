<template>
  <v-dialog
    v-model="isShown"
    width="600"
    persistent
  >
    <v-card>
      <v-toolbar color="warning">
        <v-icon left>
          local_shipping
        </v-icon>
        {{ t("dataMigration.setRootTitle") }}
      </v-toolbar>
      <v-progress-linear
        color="red"
        buffer-value="0"
        stream
      />
      <v-card-text class="mt-4">
        <p>{{ t("dataMigration.setRootDescription") }}</p>
        <p>{{ t("dataMigration.setRootCause") }}</p>
        <v-text-field
          outlined
          :value="root"
          readonly
          :placeholder="t('dataMigration.placeholder')"
          :error="!!errorText"
          :error-messages="errorText"
          append-icon="folder"
          class="mt-4"
          @click="pickupFile"
        />
        <!-- <p
          class="text-orange-400"
          v-html="t('dataMigration.directoryCriteriaHint')"
        /> -->

        <p v-if="migrating">
          {{ t("dataMigration.waitReload") }}
        </p>
      </v-card-text>
      <v-progress-linear
        color="red"
        buffer-value="0"
        stream
      />
      <v-divider />
      <v-card-actions class="gap-2">
        <v-btn
          text
          large
          :disable="migrating"
          @click="cancelApply"
        >
          {{ t("cancel") }}
        </v-btn>
        <v-spacer />
        <v-btn
          text
          large
          :disabled="!!errorText || !root"
          color="primary"
          :loading="migrating"
          @click="apply()"
        >
          <v-icon left>
            local_shipping
          </v-icon>
          {{ t("dataMigration.apply") }}
        </v-btn>
      </v-card-actions>
    </v-card>
  </v-dialog>
</template>
<script lang="ts" setup>
import { useRefreshable, useService } from '@/composables'
import { useGetDataDirErrorText } from '@/composables/dataRootErrors'
import { useGameDirectory } from '@/composables/setting'
import { useEventBus } from '@vueuse/core'
import { BaseServiceKey, MigrationException, isException } from '@xmcl/runtime-api'
import { useDialog } from '../composables/dialog'

const { showOpenDialog } = windowController
const { setGameDirectory, root: oldRoot } = useGameDirectory()
const { validateDataDictionary } = useService(BaseServiceKey)
const { t } = useI18n()

const { isShown, hide } = useDialog('migration')
const errorText = ref('')
const error = ref(undefined as undefined | Error)
const root = ref('')

const getErrorText = useGetDataDirErrorText()

async function pickupFile() {
  const { filePaths } = await showOpenDialog({
    title: t('SettingMigrationDialog.selectRootDirectory'),
    defaultPath: root.value,
    properties: ['openDirectory', 'createDirectory'],
  })
  if (filePaths && filePaths.length !== 0) {
    errorText.value = ''
    root.value = filePaths[0]
    validateDataDictionary(root.value).then((result) => {
      if (result) {
        errorText.value = getErrorText(result)
      }
    })
  }
}

function cancelApply() {
  hide()
}

const migrationBus = useEventBus<{ oldRoot: string; newRoot: string }>('migration')

const { refresh: apply, refreshing: migrating } = useRefreshable(async () => {
  try {
    migrationBus.emit({ oldRoot: oldRoot.value, newRoot: root.value })
    await setGameDirectory(root.value)
  } catch (e) {
    if (isException(MigrationException, e)) {
      errorText.value = getErrorText(e.exception.code)
    } else {
      errorText.value = t('dataMigration.unknownError')
    }
    error.value = e as any
  }
})

</script>
