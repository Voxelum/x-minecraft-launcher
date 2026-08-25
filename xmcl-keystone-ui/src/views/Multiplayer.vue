<template>
  <div
    data-testid="multiplayer-page"
    style="z-index: 2; overflow: auto"
    class="h-full w-full select-none overflow-auto"
    @dragover.prevent
  >
    <div class="flex h-full flex-col gap-2 overflow-auto" @dragover.prevent @drop="onDrop">
      <v-card class="z-5 flex-shrink-0 flex-grow-0 rounded-none px-2 py-1 pb-2" variant="flat">
        <div class="flex items-center gap-2">
          <v-progress-circular
            v-if="groupState === 'connecting'"
            indeterminate
            :size="20"
            :width="3"
          />
          {{
            groupStatus === 'waiting-master'
              ? t('multiplayer.waitingForMaster')
              : tGroupState[groupState]
          }}

          <v-chip v-if="groupState === 'connected'" size="small" label color="primary">
            <v-icon start>{{ groupRole === 'master' ? 'home' : 'person' }}</v-icon>
            {{ groupRole === 'master' ? t('multiplayer.master') : t('multiplayer.member') }}
            <template v-if="groupMaxPeers">
              · {{ groupMembers.length }}/{{ groupMaxPeers }}
            </template>
          </v-chip>

          <div class="hidden text-sm text-gray-400 lg:block">
            <template v-if="group">
              {{
                groupRole === 'master'
                  ? t('multiplayer.copyGroupToFriendHint')
                  : t('multiplayer.connectedToMaster')
              }}
            </template>
            <template v-else>
              {{ t('multiplayer.joinOrCreateGroupHint') }}
            </template>
          </div>

          <div class="flex-grow" />
          <v-btn
            v-shared-tooltip.left="() => runningClientInstances.length === 0 ? t('multiplayer.noRunningInstanceToShare') : t('multiplayer.editSharingScope')"
            variant="text"
            icon
            :disabled="runningClientInstances.length === 0"
            @click="showShareInstance()"
          >
            <v-icon>share</v-icon>
          </v-btn>

          <v-menu location="bottom end">
            <template #activator="{ props }">
              <v-btn
                id="manual-connect-button"
                v-bind="props"
                v-shared-tooltip.left="() => t('multiplayer.manualConnect')"
                variant="text"
                icon
              >
                <v-icon>build</v-icon>
              </v-btn>
            </template>
            <v-list>
              <v-list-item @click="show()">
                <v-list-item-title>
                  <v-icon start> add_call </v-icon>
                  {{ t('multiplayer.initiateConnection') }}
                </v-list-item-title>
              </v-list-item>
              <v-list-item @click="showReceive()">
                <v-list-item-title>
                  <v-icon start> login </v-icon>
                  {{ t('multiplayer.joinManual') }}
                </v-list-item-title>
              </v-list-item>
            </v-list>
          </v-menu>
        </div>
        <div class="mt-1 flex items-center gap-2">
          <v-text-field
            id="group-input"
            v-model="groupId"
            data-testid="multiplayer-group-id"
            persistent-hint
            density="compact"
            variant="filled"
            prepend-inner-icon="group"
            :label="t('multiplayer.groupId')"
            :hint="!group ? t('multiplayer.joinCreatesMissingRoomHint') : undefined"
            @click="groupState === 'connected' ? onCopy(groupId) : undefined"
          />
          <v-btn
            id="join-group-button"
            data-testid="multiplayer-join"
            v-shared-tooltip="
              () => (!group ? t('multiplayer.joinOrCreateGroup') : t('multiplayer.leaveGroup'))
            "
            variant="text"
            icon
            @click="onJoin()"
          >
            <template v-if="!group">
              <v-icon> add </v-icon>
            </template>
            <template v-else>
              <v-icon color="red"> delete </v-icon>
            </template>
          </v-btn>
          <v-btn
            v-shared-tooltip.left="() => (copied ? t('multiplayer.copied') : t('multiplayer.copy'))"
            :disabled="!group || groupState !== 'connected'"
            variant="text"
            icon
            @click="onCopy(groupId)"
          >
            <v-icon v-if="!copied"> content_copy </v-icon>
            <v-icon v-else color="success"> check </v-icon>
          </v-btn>
        </div>
        <v-alert
          v-if="groupRole === 'master' && groupState === 'connected'"
          type="info"
          density="compact"
          class="mt-2 mb-0"
        >
          {{ t('multiplayer.masterHostsGameHint') }}
        </v-alert>
        <!-- Error Banner -->
        <v-alert
          v-if="groupError"
          v-model="groupErrorVisible"
          type="error"
          density="compact"
          closable
          class="mt-2 mb-0"
        >
          <template #prepend> </template>
          <div class="flex items-center gap-2">
            <v-icon size="small">error</v-icon>
            <span>{{ t('multiplayer.connectionError') }}: {{ groupError }}</span>
          </div>
        </v-alert>
        <!-- Together recommendation for difficult network conditions -->
        <v-alert
          v-if="showTogetherRecommendation"
          type="warning"
          :icon="false"
          density="compact"
          class="mt-2 mb-0"
        >
          <div class="flex w-full items-center gap-2">
            <v-icon class="flex-shrink-0" size="small">warning</v-icon>
            <span class="min-w-0 flex-1">
              {{
                hasProblematicNat
                  ? t('multiplayer.natTogetherWarning')
                  : t('multiplayer.connectionTogetherWarning')
              }}
            </span>
            <v-btn
              class="flex-shrink-0 self-center"
              size="small"
              variant="tonal"
              :loading="togetherLoading"
              @click="onTogetherAction"
            >
              {{
                togetherRecommendationAction === 'try'
                  ? t('multiplayer.tryTogether')
                  : t('multiplayer.buyTogether')
              }}
            </v-btn>
          </div>
        </v-alert>
      </v-card>

      <v-list
        lines="two"
        class="flex flex-col justify-start gap-2 overflow-auto pb-16 pt-2"
        style="width: 100%; background: transparent"
      >
        <template v-if="navigation === 'connections'">
          <template v-if="group">
            <v-list-subheader>
              {{ t('multiplayer.connections') }}
            </v-list-subheader>
            <v-list-item
              v-for="member of groupMembers"
              :key="member.peerId"
              class="multiplayer-content flex-1 flex-grow-0"
            >
              <template #prepend>
                <v-avatar class="mr-4">
                  <v-icon>{{ member.peerId === groupSelfPeerId ? 'person' : 'group' }}</v-icon>
                </v-avatar>
              </template>
              <v-list-item-title>
                {{ member.displayName || member.accountId || member.peerId }}
              </v-list-item-title>
              <v-list-item-subtitle class="flex items-center gap-2">
                <v-chip
                  label
                  size="small"
                  :color="member.peerId === groupMasterPeerId ? 'primary' : undefined"
                >
                  <v-icon start>{{
                    member.peerId === groupMasterPeerId ? 'home' : 'person'
                  }}</v-icon>
                  {{
                    member.peerId === groupMasterPeerId
                      ? t('multiplayer.master')
                      : t('multiplayer.member')
                  }}
                </v-chip>
                <v-chip
                  label
                  size="small"
                  :color="
                    stateToColor[
                      roomConnection(member.peerId)?.connectionState ||
                        (member.status === 'connected' ? 'connected' : 'connecting')
                    ]
                  "
                >
                  <v-icon start>signal_cellular_alt</v-icon>
                  {{
                    tConnectionStates[
                      roomConnection(member.peerId)?.connectionState ||
                        (member.status === 'connected' ? 'connected' : 'connecting')
                    ]
                  }}
                </v-chip>
              </v-list-item-subtitle>
              <template #append>
                <v-btn
                  v-if="
                    groupRole === 'master' &&
                    member.peerId !== groupSelfPeerId &&
                    member.status === 'connected' &&
                    roomConnection(member.peerId)?.connectionState === 'connected'
                  "
                  v-shared-tooltip.left="() => t('multiplayer.master')"
                  icon
                  variant="text"
                  @click="transferGroupMaster(member.peerId)"
                >
                  <v-icon>home</v-icon>
                </v-btn>
              </template>
            </v-list-item>
          </template>
          <v-list-subheader>
            {{ t('multiplayer.networkInfo') }}
          </v-list-subheader>
          <v-list-item
            v-if="device"
            class="flex-1 flex-grow-0"
            @click="open(device.modelURL, '_blank')"
          >
            <template #prepend>
              <v-avatar>
                <v-icon>router</v-icon>
              </v-avatar>
            </template>
            <v-list-item-title>
              {{ t('multiplayer.routerInfo') }}
            </v-list-item-title>
            <v-list-item-subtitle class="flex items-center gap-2">
              {{ device.friendlyName }} ({{ device.modelName }})
            </v-list-item-subtitle>
            <template #append>
              <v-chip label variant="outlined">
                <v-icon start>precision_manufacturing</v-icon>
                <a :href="device.manufacturerURL">
                  {{ device.manufacturer }}
                </a>
              </v-chip>
            </template>
          </v-list-item>
          <v-list-item class="flex-1 flex-grow-0">
            <template #prepend>
              <v-avatar>
                <v-icon>wifi</v-icon>
              </v-avatar>
            </template>
            <v-list-item-title>
              {{ t('multiplayer.currentNatTitle') }}
            </v-list-item-title>
            <v-list-item-subtitle>
              <span>
                {{ t('multiplayer.currentIpTitle') }}
              </span>
              <v-chip label size="small" variant="outlined" @click="hideIp = !hideIp">
                <v-icon start size="small">
                  {{ !hideIp ? 'visibility' : 'visibility_off' }}
                </v-icon>
                {{ hideIp ? '***.***.***.***' : ips.join(', ') }}
              </v-chip>
            </v-list-item-subtitle>
            <template #append>
              <div class="flex items-center gap-2">
                <v-tooltip location="bottom" transition="scroll-y-transition" color="black">
                  <template #activator="{ props }">
                    <span v-bind="props" class="font-bold" :style="{ color: natColors[natType] }">
                      {{ natIcons[natType] }} {{ tNatType[natType] }}
                    </span>
                  </template>

                  {{ t('multiplayer.difficultyLevelHint') }}
                  <div v-for="(type, key, index) of tNatType" :key="key">
                    {{ index + 1 }}. {{ type }} {{ natIcons[key] }}
                  </div>
                </v-tooltip>
                <v-btn icon variant="text" :loading="refreshingNatType" @click="refreshNatType">
                  <v-icon>refresh</v-icon>
                </v-btn>
              </div>
            </template>
          </v-list-item>
          <v-list-item v-if="relayAllowance" class="flex-1 flex-grow-0">
            <template #prepend>
              <v-avatar color="success" variant="tonal">
                <v-icon>cloud_done</v-icon>
              </v-avatar>
            </template>
            <v-list-item-title class="text-success">
              {{ t('multiplayer.relayServiceAvailable') }}
            </v-list-item-title>
            <v-list-item-subtitle>
              {{
                t('multiplayer.relayAllowanceSummary', {
                  remaining: formatBytes(relayAllowance.remaining),
                  total: formatBytes(relayAllowance.included),
                })
              }}
            </v-list-item-subtitle>
          </v-list-item>

          <v-list-subheader>
            {{ t('multiplayer.connections') }}
          </v-list-subheader>
          <Hint
            v-if="connections.length === 0"
            icon="sports_kabaddi"
            class="multiplayer-content h-full px-4"
            :size="120"
            :text="t('multiplayer.placeholder')"
          />
          <v-list-item
            v-for="c of connections"
            :key="c.id"
            class="multiplayer-content flex-1 flex-grow-0"
          >
            <v-progress-linear v-if="c.sharing" buffer-value="0" class="absolute bottom-0" stream />
            <v-progress-linear v-if="c.sharing" buffer-value="0" class="absolute top-0" stream />
            <template #prepend>
              <v-avatar class="mr-4">
                <PlayerAvatar :dimension="40" :src="c.userInfo.avatar" />
              </v-avatar>
            </template>
            <v-list-item-title>
              {{ c.userInfo.name || c.id }}
              <v-chip
                v-if="c.remoteId === groupMasterPeerId"
                class="ml-2"
                label
                size="x-small"
                color="primary"
              >
                <v-icon start>home</v-icon>
                {{ t('multiplayer.master') }}
              </v-chip>
            </v-list-item-title>
            <v-list-item-subtitle class="flex items-center gap-2">
              <v-tooltip v-if="c.connectionState === 'failed'" location="bottom" max-width="300">
                <template #activator="{ props }">
                  <v-chip
                    v-bind="props"
                    label
                    size="small"
                    :color="stateToColor[c.connectionState]"
                  >
                    <v-icon start>error_outline</v-icon>
                    {{ tConnectionStates[c.connectionState] }}
                  </v-chip>
                </template>
                <span>{{ t('multiplayer.connectionFailedHint') }}</span>
              </v-tooltip>
              <v-chip v-else label size="small" :color="stateToColor[c.connectionState]">
                <v-icon start>signal_cellular_alt</v-icon>
                <span class="hidden lg:inline"> {{ t(`peerConnectionState.name`) }}: </span>
                {{ tConnectionStates[c.connectionState] }}
                <template v-if="c.connectionState === 'connected'"> ({{ c.ping }}ms) </template>
              </v-chip>
              <v-chip
                v-if="c.connectionState === 'connected' && c.selectedCandidate"
                label
                size="small"
                :color="isRelay(c) ? 'warning' : 'success'"
              >
                <v-icon start>{{ isRelay(c) ? 'swap_vert' : 'bolt' }}</v-icon>
                {{
                  isRelay(c) ? t('multiplayer.relayConnection') : t('multiplayer.directConnection')
                }}
              </v-chip>
            </v-list-item-subtitle>
            <template #append>
              <div class="flex items-center gap-2">
                <div v-if="c.selectedCandidate" class="mr-5 flex flex-col text-xs opacity-70">
                  <span>
                    <v-icon size="small">place</v-icon>
                    <span class="hidden lg:inline">
                      {{ tTransportType[c.selectedCandidate.local.type] }}
                    </span>
                    {{ c.selectedCandidate.local.address }}:{{ c.selectedCandidate.local.port }}
                  </span>
                  <span>
                    <v-icon size="small">person_pin_circle</v-icon>
                    <span class="hidden lg:inline">
                      {{ tTransportType[c.selectedCandidate.remote.type] }}
                    </span>
                    {{ c.selectedCandidate.remote.address }}:{{ c.selectedCandidate.remote.port }}
                  </span>
                </div>
                <div v-if="c.signalingState === 'have-local-offer'" class="mr-5 text-xs opacity-70">
                  {{ t('peerSignalingState.have-local-offer') }}
                </div>
                <div
                  v-if="c.iceGatheringState !== 'complete'"
                  class="mr-5 flex items-center gap-2 text-xs opacity-70"
                >
                  <v-progress-circular indeterminate :size="18" :width="1" />
                  {{ t('peerIceGatheringState.gathering') }}
                </div>

                <template v-if="c.sharing">
                  <v-btn
                    v-shared-tooltip="() => t('multiplayer.sharing')"
                    icon
                    variant="text"
                    @click="showShareInstance(c.sharing)"
                  >
                    <v-icon>download</v-icon>
                  </v-btn>
                  <v-btn
                    v-shared-tooltip="() => t('multiplayer.sharing')"
                    color="primary"
                    icon
                    variant="text"
                    @click="
                      c.sharing
                        ? showAddInstasnce({
                            format: 'manifest',
                            manifest: c.sharing,
                          })
                        : undefined
                    "
                  >
                    <v-icon>add</v-icon>
                  </v-btn>
                </template>

                <v-btn
                  v-if="c.connectionState !== 'connected'"
                  icon
                  variant="text"
                  @click="edit(c.id, c.initiator)"
                >
                  <v-icon>edit</v-icon>
                </v-btn>
                <v-btn
                  v-shared-tooltip.left="() => t('multiplayer.disconnect')"
                  color="error"
                  icon
                  variant="text"
                  @click="showDelete(c.id)"
                >
                  <v-icon>link_off</v-icon>
                </v-btn>
              </div>
            </template>
          </v-list-item>
        </template>
        <template v-else-if="navigation === 'settings'">
          <v-list-item class="flex-1 flex-grow-0">
            <template #prepend>
              <v-avatar>
                <v-icon>favorite</v-icon>
              </v-avatar>
            </template>
            <v-list-item-title>
              {{ t('multiplayer.kernel') }}
            </v-list-item-title>
            <v-list-item-subtitle v-shared-tooltip="() => t('multiplayer.kernelDescription')">
              {{ t('multiplayer.kernelDescription') }}
            </v-list-item-subtitle>
            <template #append>
              <v-select
                v-model="kernel"
                variant="filled"
                item-title="text"
                class="max-w-[165px]"
                hide-details
                :items="kernels"
              />
            </template>
          </v-list-item>

          <v-list-item v-if="turnserversItems.length > 0" class="flex-1 flex-grow-0">
            <template #prepend>
              <v-avatar />
            </template>
            <template #append>
              <v-select
                v-model="preferredTurnserver"
                variant="filled"
                clearable
                hide-details
                item-title="text"
                :items="turnserversItems"
                :placeholder="turnserversItems[0].text"
              />
            </template>
          </v-list-item>

          <div class="mt-2 flex items-center gap-2 px-4">
            <v-list-subheader class="!min-h-0 !p-0">
              {{ t('multiplayer.exposedPorts') }}
            </v-list-subheader>
            <v-spacer />
            <v-text-field
              v-model.number="forwardedPort"
              hide-details
              class="max-w-32"
              variant="filled"
              density="compact"
              type="number"
            />
            <v-btn icon variant="text" @click="exposePort(forwardedPort, 0)">
              <v-icon>add</v-icon>
            </v-btn>
          </div>

          <v-list-item v-for="port of exposedPorts" :key="port" class="flex-1 flex-grow-0">
            <v-list-item-title>
              {{ port }}
            </v-list-item-title>
            <v-list-item-subtitle>
              {{ t('multiplayer.exposedPortDescription') }}
            </v-list-item-subtitle>
            <template #append>
              <v-btn icon color="red" variant="text" @click="unexposePort(port)">
                <v-icon>delete</v-icon>
              </v-btn>
            </template>
          </v-list-item>
          <v-list-item
            v-for="port of otherExposedPorts"
            :key="`${port.user}:${port.port}`"
            class="flex-1 flex-grow-0"
          >
            <v-list-item-title>
              {{ port.port }}
            </v-list-item-title>
            <v-list-item-subtitle>
              {{ t('multiplayer.otherExposedPortDescription', { user: port.user }) }}
            </v-list-item-subtitle>
          </v-list-item>
        </template>
        <MultiplayerBilling
          v-else
          :overview="togetherOverview"
          :order="togetherOrder"
          :loading="togetherLoading"
          :error="togetherError"
          @refresh="refreshTogether"
          @claim-trial="claimTogetherTrial"
          @top-up="createTogetherTopUp"
          @subscribe="subscribeTogether"
          @cancel="cancelTogether"
        />
      </v-list>
      <v-bottom-navigation v-model="navigation" color="primary">
        <v-btn value="connections">
          <span> {{ t('multiplayer.connections') }} </span>
          <v-icon>wifi</v-icon>
        </v-btn>
        <v-btn value="settings">
          <span> {{ t('setting.name') }} </span>
          <v-icon> settings </v-icon>
        </v-btn>
        <v-btn value="billing">
          <span> {{ t('multiplayer.billing') }} </span>
          <v-icon> payments </v-icon>
        </v-btn>
      </v-bottom-navigation>

      <MultiplayerDialogInitiate />
      <MultiplayerDialogReceive />
      <SimpleDialog
        v-model="model"
        :title="t('multiplayer.disconnected')"
        :persistent="false"
        :width="400"
        :confirm-icon="'link_off'"
        :confirm="t('multiplayer.confirm')"
        @confirm="doDelete"
      >
        {{ t('multiplayer.disconnectDescription', { user: deletingName, id: deleting }) }}
      </SimpleDialog>
    </div>
  </div>
</template>
<script lang="ts" setup>
import Hint from '@/components/Hint.vue'
import PlayerAvatar from '@/components/PlayerAvatar.vue'
import SimpleDialog from '@/components/SimpleDialog.vue'
import { useService } from '@/composables'
import { AddInstanceDialogKey } from '@/composables/instanceTemplates'
import { kPeerState } from '@/composables/peers'
import { kTheme } from '@/composables/theme'
import { vSharedTooltip } from '@/directives/sharedTooltip'
import { injection } from '@/util/inject'
import {
  getTogetherRecommendationAction,
  hasLongConnectionProblem,
  isProblematicNatType,
  isWaffoCheckoutUrl,
  shouldRecommendTogether,
  updateConnectionProblemSince,
} from '@/util/multiplayerTogether'
import { useEventListener, useIntervalFn, useLocalStorage } from '@vueuse/core'
import { BaseServiceKey } from '@xmcl/runtime-api'
import { useDialog, useSimpleDialog } from '../composables/dialog'
import MultiplayerDialogInitiate from './MultiplayerDialogInitiate.vue'
import MultiplayerDialogReceive from './MultiplayerDialogReceive.vue'
import MultiplayerBilling from './MultiplayerBilling.vue'
import {
  XmclAccountServiceKey,
  type XmclTogetherOrder,
  type XmclTogetherOverview,
} from '@xmcl/runtime-api'
import { routeLocationKey } from 'vue-router'

const { show } = useDialog('peer-initiate')
const { show: showShareInstance } = useDialog('share-instance')
const { show: showAddInstasnce } = useDialog(AddInstanceDialogKey)
const { show: showReceive } = useDialog('peer-receive')
const route = inject(routeLocationKey, undefined)
const navigation = ref<'connections' | 'settings' | 'billing'>(
  route?.query.target === 'billing' ? 'billing' : 'connections',
)
watch(() => route?.query.target, (target) => {
  if (target === 'billing') navigation.value = 'billing'
})
const togetherService = useService(XmclAccountServiceKey)
const togetherOverview = shallowRef<XmclTogetherOverview>()
const togetherOrder = shallowRef<XmclTogetherOrder>()
const togetherLoading = ref(false)
const togetherError = shallowRef<unknown>()

async function runTogether(action: () => Promise<void>) {
  if (togetherLoading.value) return
  togetherLoading.value = true
  togetherError.value = undefined
  try {
    await action()
  } catch (error) {
    togetherError.value = error
  } finally {
    togetherLoading.value = false
  }
}

function refreshTogether() {
  return runTogether(async () => {
    if (togetherOrder.value?.status === 'pending') {
      togetherOrder.value = await togetherService.getTogetherOrder(togetherOrder.value.orderId)
    }
    togetherOverview.value = await togetherService.getTogetherOverview()
  })
}

function claimTogetherTrial() {
  return runTogether(async () => {
    await togetherService.claimTogetherTrial()
    togetherOverview.value = await togetherService.getTogetherOverview()
    await refreshIceServers()
  })
}

function createTogetherTopUp(amountMinor: number) {
  return runTogether(async () => {
    togetherOrder.value = await togetherService.createTogetherOrder(amountMinor)
    const approvalUrl = togetherOrder.value.approvalUrl
    if (!approvalUrl || !isWaffoCheckoutUrl(approvalUrl)) {
      throw new Error('invalid_waffo_checkout_url')
    }
    open(approvalUrl, '_blank')
  })
}

function subscribeTogether() {
  return runTogether(async () => {
    await togetherService.subscribeTogether()
    togetherOverview.value = await togetherService.getTogetherOverview()
    await refreshIceServers()
  })
}

function cancelTogether() {
  return runTogether(async () => {
    await togetherService.cancelTogether()
    togetherOverview.value = await togetherService.getTogetherOverview()
  })
}

function onTogetherAction() {
  if (togetherRecommendationAction.value === 'try') {
    void claimTogetherTrial()
  } else {
    navigation.value = 'billing'
  }
}

onMounted(() => {
  void refreshTogether()
})
useEventListener(window, 'focus', () => {
  if (togetherOrder.value?.status === 'pending') void refreshTogether()
})

const hideIp = ref(true)
const showNetworkInfo = useLocalStorage('peerShowNetworkInfo', true, { writeDefaults: false })

const open = (...args: any[]) => window.open(...args)

const {
  show: showDelete,
  target: deleting,
  confirm: doDelete,
  model,
} = useSimpleDialog<string>((v) => {
  if (!v) return
  console.log(`drop connection ${v}`)
  drop(v)
})
const {
  exposedPorts,
  exposePort,
  unexposePort,
  otherExposedPorts,
  connections,
  turnservers,
  group,
  groupRole,
  groupSelfPeerId,
  groupMasterPeerId,
  groupMembers,
  groupStatus,
  groupMaxPeers,
  groupState,
  icePings,
  createGroup,
  joinGroup,
  leaveGroup,
  transferGroupMaster,
  drop,
  ips,
  device,
  natType,
  refreshingNatType,
  refreshNatType,
  refreshIceServers,
  runningClientInstances,
  error: groupError,
} = injection(kPeerState)
const groupErrorVisible = ref(true)
watch(groupError, () => {
  groupErrorVisible.value = true
})
const connectionProblemSince = reactive(new Map<string, number>())
const connectionClock = ref(Date.now())
useIntervalFn(() => {
  connectionClock.value = Date.now()
}, 1_000)
watchEffect(() => {
  const now = Date.now()
  if (groupRole.value !== 'master' || groupState.value !== 'connected') {
    connectionProblemSince.clear()
    return
  }
  updateConnectionProblemSince(
    connectionProblemSince,
    groupMembers.value
      .filter((member) => member.peerId !== groupSelfPeerId.value)
      .map((member) => ({
        member,
        connectionState: connections.value.find(
          (connection) => connection.remoteId === member.peerId,
        )?.connectionState,
      })),
    now,
  )
})
const hasProblematicNat = computed(() => isProblematicNatType(natType.value))
const hasLongRoomConnectionProblem = computed(
  () =>
    groupRole.value === 'master' &&
    hasLongConnectionProblem(connectionProblemSince, connectionClock.value),
)
const togetherRecommendationAction = computed(() =>
  getTogetherRecommendationAction(togetherOverview.value?.trial.status),
)
const showTogetherRecommendation = computed(
  () =>
    shouldRecommendTogether({
      problematicNat: hasProblematicNat.value,
      isMaster: groupRole.value === 'master',
      longConnectionProblem: hasLongRoomConnectionProblem.value,
      trialStatus: togetherOverview.value?.trial.status,
      subscriptionStatus: togetherOverview.value?.subscription?.status,
    }),
)
const relayAllowance = computed(() =>
  togetherOverview.value?.subscription?.status === 'active'
    ? togetherOverview.value.allowances.turnEgressBytes
    : undefined,
)
const { t, locale } = useI18n()
const { handleUrl } = useService(BaseServiceKey)
const forwardedPort = ref(0)

const kernel = useLocalStorage<'node-datachannel' | 'webrtc'>('peerKernel', 'node-datachannel', {
  writeDefaults: false,
})
const kernels = computed(() => [
  { value: 'node-datachannel', text: 'node-datachannel' },
  { value: 'webrtc', text: 'WebRTC' },
])

function getIceServerPingText(value: number | 'timeout' | undefined) {
  if (value === undefined) return ''
  return ` (${value}ms)`
}

function formatBytes(bytes: number) {
  const units = ['B', 'KB', 'MB', 'GB', 'TB']
  const unitIndex = bytes > 0
    ? Math.min(Math.floor(Math.log(bytes) / Math.log(1000)), units.length - 1)
    : 0
  const value = bytes / 1000 ** unitIndex
  return `${new Intl.NumberFormat(locale.value, { maximumFractionDigits: 2 }).format(value)} ${units[unitIndex]}`
}

const preferredTurnserver = useLocalStorage('peerPreferredTurn', '', { writeDefaults: false })
const turnserversItems = computed(() =>
  Object.entries(turnservers.value).map(([key, value]) => ({
    value: key,
    text: `${tLocale.value[value as string] || value}${getIceServerPingText(icePings.value[key])}`,
  })),
)
const tLocale = computed(
  () =>
    ({
      liaoning: t('turnRegion.liaoning'),
      guangzhou: t('turnRegion.guangzhou'),
      hk: t('turnRegion.hk'),
      fr: t('turnRegion.fr'),
      po: t('turnRegion.po'),
    }) as Record<string, string>,
)

const { errorColor, successColor, warningColor } = injection(kTheme)

const tGroupState = computed(() => ({
  connected: '✔️ ' + t('peerGroupState.connected'),
  connecting: t('peerGroupState.connecting'),
  closed: '🕒 ' + t('peerGroupState.closed'),
  closing: t('peerGroupState.closing'),
}))

const natIcons = computed(() => ({
  Blocked: '⛔',
  'Open Internet': '🌐',
  'Full Cone': '🍦',
  'Restrict NAT': '⭕🍦',
  'Restrict Port NAT': '🛑🍦',
  'Symmetric UDP Firewall': '🧱',
  'Symmetric NAT': '↔️',
  Unknown: '❓',
}))
const natColors = computed(() => ({
  Blocked: errorColor.value,
  'Open Internet': successColor.value,
  'Full Cone': successColor.value,
  'Restrict NAT': warningColor.value,
  'Restrict Port NAT': warningColor.value,
  'Symmetric UDP Firewall': errorColor.value,
  'Symmetric NAT': errorColor.value,
  Unknown: t('natType.unknown'),
}))

const tTransportType = computed(() => ({
  relay: t('transportType.relay'),
  srflx: t('transportType.srflx'),
  host: t('transportType.host'),
  prflx: t('transportType.prflx'),
}))
const tNatType = computed(() => ({
  'Open Internet': t('natType.openInternet'),
  'Full Cone': t('natType.fullCone'),
  'Restrict NAT': t('natType.restrictNat'),
  'Restrict Port NAT': t('natType.restrictPortNat'),
  'Symmetric UDP Firewall': t('natType.symmetricUDPFirewall'),
  'Symmetric NAT': t('natType.symmetricNat'),
  Blocked: t('natType.blocked'),
  Unknown: t('natType.unknown'),
}))

const groupId = ref(group.value || '')
const deletingName = computed(
  () => connections.value.find((c) => c.id === deleting.value)?.userInfo.name,
)
const copied = ref(false)

const joiningGroup = computed(() => groupState.value === 'connecting')

watch(
  group,
  (newVal) => {
    if (newVal) {
      groupId.value = newVal
    }
  },
  { immediate: true },
)

const stateToColor: Record<string, string> = {
  failed: 'error',
  disconnected: 'error',
  connected: 'primary',
  closed: 'secondary',
}

const tConnectionStates = computed(() => ({
  closed: t('peerConnectionState.closed'),
  connected: t('peerConnectionState.connected'),
  connecting: t('peerConnectionState.connecting'),
  disconnected: t('peerConnectionState.disconnected'),
  failed: t('peerConnectionState.failed'),
  new: t('peerConnectionState.new'),
}))

const isRelay = (connection: (typeof connections.value)[number]) =>
  connection.selectedCandidate?.local.type === 'relay' ||
  connection.selectedCandidate?.remote.type === 'relay'

const roomConnection = (peerId: string) =>
  connections.value.find((connection) => connection.remoteId === peerId)

const edit = (id: string, init: boolean) => {
  const conn = connections.value.find((c) => c.id === id)
  if (conn) {
    if (init) {
      show(id)
    } else {
      showReceive(id)
    }
  }
}

const onDrop = (e: DragEvent) => {
  const url = e.dataTransfer?.getData('xmcl/url')
  if (url) {
    handleUrl(url)
  }
}
const onCopy = (val: string) => {
  if (groupId.value) {
    windowController.writeClipboard(val)
    copied.value = true
    setTimeout(() => {
      copied.value = false
    }, 3_000)
  }
}

const onJoin = () => {
  if (!group.value) {
    const roomId = groupId.value.trim()
    if (roomId) {
      joinGroup(roomId)
    } else {
      createGroup()
    }
  } else {
    leaveGroup()
  }
}

// useTutorial(computed(() => [
//   { element: '#group-input', popover: { title: t('tutorial.multiplayer.groupTitle'), description: t('tutorial.multiplayer.groupDescription') } },
//   { element: '#join-group-button', popover: { title: t('tutorial.multiplayer.groupTitle'), description: t('tutorial.multiplayer.joinDescription') } },
//   { element: '.multiplayer-content', popover: { title: t('tutorial.multiplayer.contentTitle'), description: t('tutorial.multiplayer.contentDescription') } },
//   { element: '#manual-connect-button', popover: { title: t('multiplayer.manualConnect'), description: t('tutorial.multiplayer.manualDescription') } },
// ]))
</script>
