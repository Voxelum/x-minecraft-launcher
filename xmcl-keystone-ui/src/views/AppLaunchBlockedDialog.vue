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
import { useLaunchException } from '@/composables/launchException'

const { on } = useService(LaunchServiceKey)
const { isShown, hide } = useDialog('launch-blocked')
const title = ref('')
const description = ref('')
const unexpected = ref(false)
const extraText = ref('')
const { t } = useI18n()

const { onException: _onException, onError } = useLaunchException(
  title,
  description,
  unexpected,
  extraText
)

function onException(e: LaunchExceptions) {
  _onException(e)
  isShown.value = true
}

on('error', (e) => {
  onError(e)
  isShown.value = true
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
