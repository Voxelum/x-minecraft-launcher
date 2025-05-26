<script setup lang="ts">
import { useDialog } from '@/composables/dialog'
import { kInstance } from '@/composables/instance';
import { kInstanceFiles } from '@/composables/instanceFiles';
import { injection } from '@/util/inject';

const { isShown } = useDialog('InstanceInstallSkipDialog')
const { shouldHintUserSkipChecksum, blockingFiles, resetChecksumError, resumeInstall } = injection(kInstanceFiles)
const { path } = injection(kInstance)

const { t } = useI18n()

watch(shouldHintUserSkipChecksum, (count) => {
  if (count && count >= 1) {
    isShown.value = true
  }
}, { immediate: true })

function onCancel() {
  isShown.value = false
}

function onSkip() {
  if (blockingFiles.value) {
    const files = blockingFiles.value.map((f) => ({
      ...f.file, hashes: {
        sha1: f.actual,
      }
    }))
    resetChecksumError()
    resumeInstall(path.value, files)
  }
  isShown.value = false
}

</script>
<template>
  <v-dialog v-model="isShown" width="600">
    <v-card>
      <v-card-title>
        {{ t('instanceInstallSkip.title') }}
      </v-card-title>
      <v-card-text>
        <v-alert type="warning" icon="warning">
          {{ t('instanceInstallSkip.warning') }}
        </v-alert>
        <v-list>
          <v-list-item v-for="i of blockingFiles" :key="i.file.path">
            <v-list-item-content>
              <v-list-item-title class="whitespace-normal overflow-auto">{{ i.file.path }}</v-list-item-title>
              <v-list-item-subtitle class="whitespace-normal overflow-auto">
                {{ t('errors.ChecksumNotMatchError', { expect: i.expect, actual: i.actual }) }}
              </v-list-item-subtitle>
            </v-list-item-content>
          </v-list-item>
        </v-list>
      </v-card-text>
      <v-card-actions>
        <v-btn text @click="onCancel">
          <v-icon left>refresh</v-icon> {{ t('instanceInstallSkip.ignore') }}
        </v-btn>
        <v-spacer />
        <v-btn text color="primary" @click="onSkip">
          <v-icon left> check </v-icon> {{ t('instanceInstallSkip.skip') }}
        </v-btn>
      </v-card-actions>
    </v-card>
  </v-dialog>
</template>