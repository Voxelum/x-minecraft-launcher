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
        {{ t('multiplayer.initiateConnection') }}
      </v-stepper-step>
      <v-stepper-content step="1">
        <div class="flex items-center justify-center">
          <div>
            {{ t('multiplayer.startNewP2PConnection') }}
            <p class="text-gray-400 text-sm">
              {{ t('multiplayer.joinConnection') }}
            </p>
          </div>
          <div class="flex-grow" />
          <v-btn
            text
            outlined
            color="primary"
            @click="initiate"
          >
            {{ t('multiplayer.start') }}
          </v-btn>
        </div>
      </v-stepper-content>

      <v-stepper-step
        :complete="step > 2"
        :editable="step > 2"
        step="2"
      >
        {{ t('multiplayer.createLocalToken') }}
      </v-stepper-step>
      <v-stepper-content
        step="2"
      >
        <div class="flex flex-col gap-2">
          <div class="flex items-center justify-center gap-2">
            <div
              class="max-w-160"
              v-html="t('multiplayer.gatheringIce')"
            />
            <div class="flex-grow" />
            <div
              v-if="gatheringState !== 'complete'"
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
          <div v-html="t('multiplayer.copyLocalHint')" />
          <div class="flex mt-3 gap-2 items-center justify-center text-amber-500">
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
              {{ copied ? t('copied') : t('multiplayer.copy') }}
            </v-btn>
            <div class="flex-grow" />
            <v-btn
              text
              outlined
              :color="initiating ? '' : 'primary'"
              :disabled="freeze"
              @click="step++"
            >
              {{ t('multiplayer.next') }}
            </v-btn>
          </div>
        </div>
      </v-stepper-content>

      <v-stepper-step
        step="3"
      >
        {{ t('multiplayer.enterRemoteToken') }}
      </v-stepper-step>
      <v-stepper-content step="3">
        {{ t('multiplayer.enterRemoteTokenHint') }}
        <v-textarea
          v-model="remoteDescription"
          outlined
          class="flex-grow-0 mt-4"
          :label="t('multiplayer.enterRemoteToken')"
          :error="error"
          :error-messages="errorText"
        />
        <div class="flex">
          <v-btn
            text
            outlined
            @click="step--"
          >
            {{ t('multiplayer.previous') }}
          </v-btn>
          <div class="flex-grow" />
          <v-btn
            text
            outlined
            color="primary"
            :loading="connecting"
            @click="connect"
          >
            {{ t('multiplayer.confirm') }}
          </v-btn>
        </div>
      </v-stepper-content>
    </v-stepper>
  </v-dialog>
</template>
<script lang=ts setup>
import { createOfferAppUrl, PeerServiceKey } from '@xmcl/runtime-api'
import { useDialog } from '../composables/dialog'
import { useCurrentUser } from '../composables/user'
import { useRefreshable, useService, useServiceBusy } from '@/composables'

const { gameProfile } = useCurrentUser()
const { isShown, parameter } = useDialog('peer-initiate')

const service = useService(PeerServiceKey)
const id = ref('')
const gatheringState = computed(() => connection.value?.iceGatheringState)
const connection = computed(() => service.state.connections.find(c => c.id === id.value))
const localDescription = computed(() => connection.value ? (connection.value.localDescriptionSDP) : '')
const localUrl = computed(() => createOfferAppUrl(localDescription.value, gameProfile.value.name))
const { t } = useI18n()

const remoteDescription = ref('')
const step = ref(1)
const done = ref(false)
const connectionState = computed(() => connection.value?.connectionState)
const freeze = ref(false)
const errorText = ref('')
const error = computed(() => !!errorText.value)

watch(isShown, (v) => {
  if (v && typeof parameter.value === 'string') {
    id.value = parameter.value
    if (gatheringState.value === 'complete') {
      step.value = 3
    } else {
      step.value = 2
    }
  } else {
    copied.value = false
    step.value = 1
    remoteDescription.value = ''
  }
})

const copied = ref(false)

function copyLocalDescription() {
  navigator.clipboard.writeText(localDescription.value)
  copied.value = true
}

const connecting = useServiceBusy(PeerServiceKey, 'answer', id)
const initiating = useServiceBusy(PeerServiceKey, 'initiate', id)

const { refresh: connect } = useRefreshable(async () => {
  try {
    if (remoteDescription.value === localDescription.value) {
      errorText.value = t('multiplayer.illegalTokenDescription')
      return
    }
    await service.answer(remoteDescription.value)
    id.value = ''
    done.value = true
    isShown.value = false
  } catch (e) {
    if (e instanceof TypeError) {
      errorText.value = t('multiplayer.illegalTokenDescription')
    } else {
      errorText.value = t('multiplayer.illegalTokenDescription')
    }
  }
})

const { refresh: initiate } = useRefreshable(async () => {
  step.value += 1
  id.value = await service.create()
  setTimeout(() => { freeze.value = false }, 4000)
  freeze.value = true
  await service.initiate(id.value)
})

</script>

<i18n locale="en" lang="yaml">
multiplayer:
  enterRemoteTokenHint: >-
    Once your peer enter your token, you need to enter his token to the text
    area below. Click confirm to connect.
  copyLocalHint: >
    "Please copy the local SDP text and send it to your object to have your
    object enter this text in the join connection <span>A token can be only used
    for <span style="color: red; font-weight: bold;">one peer</span>! You cannot
    send the same token to multiple peer!</span> <br> <span style="color:
    rgba(255,255,255,0.7); font-style: italic;">If you need to connect multiple
    peers, you need to create <span style="font-weight: bold; color: rgba(245,
    158, 11)">multiple</span> connections.</span>"
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
copied: Copied!
copyUrl: Copy URL
</i18n>

<i18n locale="zh-CN" lang="yaml">
multiplayer:
  enterRemoteTokenHint: 当你的联机伙伴输入你的令牌后，你需要将他的令牌输入到下面的文字框中，并点击确定开始连接。
  copyLocalHint: >
    <span>一段令牌只能用<span style="color: red; font-weight:bold;">一次</span>！你不能将一个令牌发送给多个小伙伴！</span>
    <br>
    <span style="color: rgba(255,255,255,0.7); font-style: italic;">如果有多个小伙伴要加入你需要<span style="font-weight: bold; color: rgba(245, 158, 11)">多次</span>建立连接。</span>
  gatheringIce: >
    请将<span class="v-chip v-chip--label v-size--small" style="text-font: bold">本地令牌</span>发送给你的联机伙伴，你的联机伙伴在
    <span class="v-chip v-chip--label v-size--small" style="text-font: bold"> 加入连接 </span> 中输入这段文字。
    <br>
    期间 ICE 服务器可能需要时间收集足够信息来创建<span class="v-chip v-chip--label v-size--small" style="text-font: bold">本地令牌</span>。
    <br>
    <span style="color: rgba(255,255,255,0.7);"> 你不需要等 ICE 服务器完全收集完毕，当下面的令牌已经有内容并且不怎么变化后，你可以提前将令牌复制给对方。 </span>
copied: 已复制!
copyUrl: 复制 URL
</i18n>
