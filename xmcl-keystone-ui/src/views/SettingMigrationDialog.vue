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
          :error="!!error"
          :error-messages="errorText"
          append-icon="folder"
          class="mt-4"
          @click="pickupFile"
        />
        <p
          class="text-orange-400"
          v-html="t('dataMigration.directoryCriteriaHint')"
        />

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
import { useRefreshable } from '@/composables'
import { useGameDirectory } from '@/composables/setting'
import { useEventBus } from '@vueuse/core'
import { BaseServiceException, isException } from '@xmcl/runtime-api'
import { useDialog } from '../composables/dialog'

const { showOpenDialog } = windowController
const { setGameDirectory, root: oldRoot } = useGameDirectory()
const { t } = useI18n()

const { isShown, hide } = useDialog('migration')
const errorText = ref('')
const error = ref(undefined as undefined | Error)
const errorDetails = computed(() => {
  if (error.value) {
    return `${error.value.name}\n${error.value.message ?? ''}\n${error.value.stack ?? ''}`
  }
  return ''
})
const root = ref('')

async function pickupFile() {
  const { filePaths } = await showOpenDialog({
    title: t('SettingMigrationDialog.selectRootDirectory'),
    defaultPath: root.value,
    properties: ['openDirectory', 'createDirectory'],
  })
  if (filePaths && filePaths.length !== 0) {
    root.value = filePaths[0]
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
    if (isException(BaseServiceException, e)) {
      if (e.exception.type === 'migrationDestinationIsFile') {
        errorText.value = t('dataMigration.migrationDestinationIsFile')
      } else if (e.exception.type === 'migrationDestinationIsNotEmptyDirectory') {
        errorText.value = t('dataMigration.migrationDestinationIsNotEmptyDirectory')
      } else if (e.exception.type === 'migrationNoPermission') {
        errorText.value = t('dataMigration.migrationNoPermission')
      } else {
        errorText.value = t('dataMigration.unknownError')
      }
    } else {
      errorText.value = t('dataMigration.unknownError')
    }
    error.value = e as any
  }
})

</script>
