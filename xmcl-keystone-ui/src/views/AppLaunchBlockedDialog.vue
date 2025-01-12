<template>
  <v-dialog
    v-model="isShown"
    :width="500"
    :persistent="true"
  >
    <v-alert
      class="blocked-dialog mb-0"
      border="left"
      type="error"
      prominent
    >
      <v-card
        color="transparent"
        elevation="0"
        text
      >
        <v-card-title
          primary-title
          class="text-2xl font-bold"
        >
          {{ title }}
        </v-card-title>
        <v-card-text class="text-lg">
          <span v-html="description" />

          <v-textarea
            v-if="extraText"
            :value="extraText"
            readonly
          />

          <div v-if="unexpected">
            {{ t('launchBlocked.unexpectedText') }}
          </div>
        </v-card-text>
        <FeedbackCard
          class="mb-3"
          :icon="false"
          border="bottom"
        />
        <v-divider />
        <v-card-actions>
          <v-spacer />
          <v-btn
            text
            @click="hide"
          >
            {{ t('ok') }}
          </v-btn>
        </v-card-actions>
      </v-card>
    </v-alert>
  </v-dialog>
</template>

<script lang=ts setup>
import { useService } from '@/composables'
import { useExceptionHandler } from '@/composables/exception'
import { isException, LaunchException, LaunchExceptions, LaunchServiceKey } from '@xmcl/runtime-api'
import FeedbackCard from '../components/FeedbackCard.vue'
import { useDialog } from '../composables/dialog'

const { on } = useService(LaunchServiceKey)
const { isShown, hide } = useDialog('launch-blocked')
const title = ref('')
const description = ref('')
const unexpected = ref(false)
const extraText = ref('')
const { t } = useI18n()

function onException(e: LaunchExceptions) {
  if (e.type === 'launchInvalidJavaPath') {
    title.value = t('launchBlocked.launchInvalidJavaPath.title')
    description.value = t('launchBlocked.launchInvalidJavaPath.description', { javaPath: e.javaPath })
    unexpected.value = true
    extraText.value = ''
  } else if (e.type === 'launchJavaNoPermission') {
    title.value = t('launchBlocked.launchJavaNoPermission.title')
    description.value = t('launchBlocked.launchJavaNoPermission.description', { javaPath: e.javaPath })
    unexpected.value = false
    extraText.value = ''
  } else if (e.type === 'launchNoProperJava') {
    title.value = t('launchBlocked.launchNoProperJava.title')
    description.value = t('launchBlocked.launchNoProperJava.description', { javaPath: e.javaPath })
    unexpected.value = true
    extraText.value = ''
  } else if (e.type === 'launchNoVersionInstalled') {
    title.value = t('launchBlocked.launchNoVersionInstalled.title')
    description.value = t('launchBlocked.launchNoVersionInstalled.description', { version: e.options?.version })
    unexpected.value = true
    extraText.value = ''
  } else if (e.type === 'launchBadVersion') {
    title.value = t('launchBlocked.launchBadVersion.title')
    description.value = t('launchBlocked.launchBadVersion.description', { version: e.version })
    unexpected.value = true
    extraText.value = ''
  } else if (e.type === 'launchSpawnProcessFailed') {
    title.value = t('launchBlocked.launchSpawnProcessFailed.title')
    description.value = t('launchBlocked.launchSpawnProcessFailed.description')
  }
  isShown.value = true
}

on('error', (e) => {
  if (isException(LaunchException, e)) {
    onException(e.exception)
  } else {
    title.value = t('launchBlocked.launchGeneralException.title')
    description.value = t('launchBlocked.launchGeneralException.description')
    unexpected.value = true
    if (typeof e.stack === 'string') {
      extraText.value += e.stack
    } else if (typeof e.message === 'string') {
      extraText.value = e.message
    } else if (typeof e.toString === 'function') {
      extraText.value = e.toString()
    } else {
      extraText.value = ''
    }
  }
})

useExceptionHandler(LaunchException, (e) => {
  onException(e)
})
</script>

<style>
.blocked-dialog .highlight {
  @apply rounded p-1 text-white font-bold;
}
</style>
