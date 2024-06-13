<template>
  <v-dialog
    v-model="isShown"
    fullscreen
    hide-overlay
    transition="dialog-bottom-transition"
    scrollable
  >
    <v-stepper
      v-model="step"
      vertical
    >
      <v-stepper-step
        :complete="step > 1"
        step="1"
      >
        {{ t('multiplayer.enterRemoteToken') }}
      </v-stepper-step>

      <v-stepper-content step="1">
        <div>
          {{ t('multiplayer.receiveRemoteTokenHint') }}
        </div>
        <v-textarea
          v-model="remoteDescription"
          class="mt-4 flex-grow-0"
          outlined
          :label="t('multiplayer.remoteToken')"
          :error="error"
          :error-messages="errorText"
        />
        <div class="flex w-full">
          <div class="flex-grow" />
          <v-btn
            text
            outlined
            color="primary"
            :loading="answering"
            @click="answer(); "
          >
            {{ t('multiplayer.next') }}
          </v-btn>
        </div>
      </v-stepper-content>
      <v-stepper-step
        step="2"
      >
        {{ t('multiplayer.sendTokenToRemote') }}
      </v-stepper-step>

      <v-stepper-content
        step="2"
      >
        <div class="flex items-center justify-center gap-4">
          <div
            class="max-w-160"
            v-html="t('multiplayer.gatheringIce')"
          />
          <div class="flex-grow" />
          <div
            v-if="gatheringState === 'gathering'"
            class="text-gray-400"
          >
            {{ t('peerIceGatheringState.gathering') }}
            <v-progress-circular
              class="ml-2"
              :width="1"
              :size="20"
              indeterminate
            />
          </div>
        </div>
        <v-textarea
          :value="localDescription"
          class="mt-4"
          outlined
          readonly
          :label="t('multiplayer.localToken')"
          @mousedown="copyLocalDescription"
        />
        <div class="mb-4">
          {{ t('multiplayer.receiveHint') }}
        </div>
        <div class="flex">
          <v-btn
            text
            outlined
            @click="copyLocalDescription"
          >
            <v-icon
              v-if="!copied"
              left
            >
              content_copy
            </v-icon>
            <v-icon
              v-else
              left
              color="success"
            >
              check
            </v-icon>
            {{ t('multiplayer.copy') }}
          </v-btn>
          <div class="flex-grow" />
          <v-btn
            color="primary"
            @click="isShown = false"
          >
            {{ t('multiplayer.complete') }}
          </v-btn>
        </div>
      </v-stepper-content>
    </v-stepper>
  </v-dialog>
</template>
<script lang=ts setup>
import { useRefreshable } from '@/composables'
import { kPeerState } from '@/composables/peers'
import { kUserContext } from '@/composables/user'
import { injection } from '@/util/inject'
import { createAnswerAppUrl } from '@xmcl/runtime-api'
import { useDialog } from '../composables/dialog'

const { isShown, parameter } = useDialog('peer-receive')
const { gameProfile } = injection(kUserContext)
const { connections, setRemoteDescription } = injection(kPeerState)

const connection = computed(() => connections.value.find(c => c.id === id.value))
const localDescription = computed(() => connection.value?.localDescriptionSDP ? (connection.value?.localDescriptionSDP) : '')
const localSdpUrl = computed(() => createAnswerAppUrl(localDescription.value, gameProfile.value.name))
const { t } = useI18n()

const remoteDescription = ref('')
const id = ref('')
const gatheringState = computed(() => connection.value?.iceGatheringState)

const step = ref(1)
const done = ref(false)
const errorText = ref('')
const error = computed(() => !!errorText.value)
const copied = ref(false)

watch(isShown, (v) => {
  if (v && typeof parameter.value === 'string') {
    id.value = parameter.value as string
    step.value = 2
  } else {
    copied.value = false
    step.value = 1
    remoteDescription.value = ''
  }
})

function copyLocalDescription() {
  navigator.clipboard.writeText(localDescription.value)
  copied.value = true
}

const { refresh: answer, refreshing: answering } = useRefreshable(async () => {
  errorText.value = ''
  try {
    if (!remoteDescription.value) {
      throw new SyntaxError()
    }
    if (remoteDescription.value === localDescription.value) {
      throw new Error('Cannot enter token from yourself!')
    }
    id.value = await setRemoteDescription('answer', remoteDescription.value)
    done.value = true
    step.value++
  } catch (e) {
    if (e instanceof SyntaxError) {
      errorText.value = t('multiplayer.illegalTokenDescription')
    } else {
      errorText.value = t('multiplayer.illegalTokenDescription')
    }
    console.log(e)
  }
})

</script>
