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
          :placeholder="t('placeholder')"
          :error="!!error"
          :error-messages="errorText"
          append-icon="folder"
          class="mt-4"
          @click="pickupFile"
        />
        <p
          class="text-orange-400"
          v-html="t('directoryCriteriaHint')"
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
import { BaseServiceException, BaseServiceKey, isException } from '@xmcl/runtime-api'
import { useDialog } from '../composables/dialog'
import { useI18n, useRefreshable, useService } from '/@/composables'

const { showOpenDialog } = windowController
const { migrate, state } = useService(BaseServiceKey)
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
    title: t('selectRootDirectory'),
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

const { refresh: apply, refreshing: migrating } = useRefreshable(async () => {
  try {
    await migrate({ destination: root.value })
  } catch (e) {
    if (isException(BaseServiceException, e)) {
      if (e.exception.type === 'migrationDestinationIsFile') {
        errorText.value = t('migrationDestinationIsFile')
      } else if (e.exception.type === 'migrationDestinationIsNotEmptyDirectory') {
        errorText.value = t('migrationDestinationIsNotEmptyDirectory')
      } else {
        errorText.value = t('unknownError')
      }
    } else {
      errorText.value = t('unknownError')
    }
    error.value = e as any
  }
})

</script>

<i18n locale="en" lang="yaml">
directoryCriteriaHint: Please make sure your new directory location is an EMPTY directory!
selectRootDirectory: Select Root Directory
placeholder: Please click here to select directory
migrationDestinationIsFile: Migration destination is a file! Please select an empty directory!
migrationDestinationIsNotEmptyDirectory: Migration destination is not an empty directory! Please make sure you select an empty directory!
unknownError: Unknown Error! Please retry or contact the developer!
</i18n>

<i18n locale="zh-CN" lang="yaml">
directoryCriteriaHint: 请确保你选择的新的文件夹是一个<span class="font-bold text-lg mx-1">空</span>文件夹。
selectRootDirectory: 选择新的根目录
placeholder: 点击来选择新的根目录
migrationDestinationIsFile: 迁移目标地址是个文件而不是文件夹！请重新选择一个空的文件夹！
migrationDestinationIsNotEmptyDirectory: 迁移目标不是一个空的文件夹！请确保你选择了一个空的文件夹！
unknownError: 未知错误，请联系作者或重试。
</i18n>
