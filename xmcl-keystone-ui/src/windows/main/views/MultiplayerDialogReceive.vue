<template>
  <v-dialog
    v-model="isShown"
    class="mx-20"
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
          class="flex-grow-0 mt-4"
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
            <v-icon left>
              content_copy
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
import { createAnswerAppUrl, PeerServiceKey } from '@xmcl/runtime-api'
import { useDialog } from '../composables/dialog'
import { useCurrentUser } from '../composables/user'
import { useI18n, useRefreshable, useService } from '/@/composables'

const { isShown, parameter } = useDialog('peer-receive')
const { gameProfile } = useCurrentUser()

const service = useService(PeerServiceKey)
const connection = computed(() => service.state.connections.find(c => c.id === id.value))
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

watch(isShown, (v) => {
  if (v && typeof parameter.value === 'string') {
    id.value = parameter.value as string
    step.value = 2
  } else {
    step.value = 1
    remoteDescription.value = ''
  }
})

function copyLocalDescription() {
  navigator.clipboard.writeText(localDescription.value)
}

const { refresh: answer, refreshing: answering } = useRefreshable(async () => {
  errorText.value = ''
  try {
    if (!remoteDescription.value) {
      throw new SyntaxError()
    }
    id.value = await service.offer(remoteDescription.value)
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

<i18n locale="en" lang="yaml">
multiplayer:
  sendTokenToRemote: Send Token to Remote
  receiveHint: >-
    After the other party enters your token, your connection will create
    automatically. Now you can close the dialog.
  receiveRemoteTokenHint: Please enter the token from your peer here.
  gatheringIce: >
    "Please wait for the ICE server to collect enough information about your
    network. If you are impatient and there are enough information, you can give
    the current SDP to the other party in advance and click Next Please send the
    <span class="v-chip v-chip--label v-size--small" style="text-font: bold"
    >Local Token</span> to your peer, you peer enter your token in <span
    class="v-chip v-chip--label v-size--small" style="text-font: bold"> Join
    Connection </span> section. <br> The ICE server might need some time to
    collect your info to create <span class="v-chip v-chip--label v-size--small"
    style="text-font: bold">Local token</span>.<br> You do not need to wait
    until the ICE status complete. If the token below remain unchanged, you can
    copy it and send to you peer."
</i18n>

<i18n locale="zh-CN" lang="yaml">
multiplayer:
  sendTokenToRemote: 将本地令牌给你的联机伙伴
  receiveHint: 在对方输入你的令牌后，你们之间的连接会自动创建。现在你已经可以点击完成了。
  receiveRemoteTokenHint: 请将联机伙伴的令牌粘贴在此处，并点击下一步
  gatheringIce: >
    请将<span class="v-chip v-chip--label v-size--small" style="text-font: bold">本地令牌</span>发送给你的联机伙伴，你的联机伙伴在
    <span class="v-chip v-chip--label v-size--small" style="text-font: bold"> 加入连接 </span> 中输入这段文字。
    <br>
    期间 ICE 服务器可能需要时间收集足够信息来创建<span class="v-chip v-chip--label v-size--small" style="text-font: bold">本地令牌</span>。
    <br>
    <span style="color: rgba(255,255,255,0.7);"> 你不需要等 ICE 服务器完全收集完毕，当下面的令牌已经有内容并且不怎么变化后，你可以提前将令牌复制给对方。 </span>
</i18n>
