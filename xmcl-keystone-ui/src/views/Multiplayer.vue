<template>
  <div
    data-testid="multiplayer-page"
    style="z-index: 2; overflow: auto"
    class="h-full w-full select-none overflow-auto"
    @dragover.prevent
  >
    <div class="flex h-full flex-col gap-2 overflow-auto" @dragover.prevent @drop="onDrop">
      <v-card class="z-5 flex-shrink flex-grow-0 rounded-none px-2 py-1 pb-2" variant="flat">
        <div class="flex items-center gap-2">
          <v-progress-circular
            v-if="groupState === 'connecting'"
            indeterminate
            :size="20"
            :width="3"
          />
          {{ tGroupState[groupState] }}

          <v-chip v-if="groupState === 'connected'" size="small" label color="primary">
            <v-icon start> signal_cellular_alt </v-icon>
            {{ groupPing + 'ms' }}

            {{ pingAgo }}
          </v-chip>

          <div class="hidden text-sm text-gray-400 lg:block">
            <template v-if="group">
              {{ t('multiplayer.copyGroupToFriendHint') }}
            </template>
            <template v-else>
              {{ t('multiplayer.joinOrCreateGroupHint') }}
            </template>
          </div>

          <div class="flex-grow" />
          <v-btn
            v-shared-tooltip.left="() => t('multiplayer.share')"
            variant="text"
            icon
            @click="showShareInstance()"
          >
            <v-icon> share </v-icon>
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
                <v-icon> build </v-icon>
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
            hide-details
            density="compact"
            variant="filled"
            prepend-inner-icon="group"
            :label="t('multiplayer.groupId')"
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
            :disabled="!group"
            variant="text"
            icon
            @click="onCopy(groupId)"
          >
            <v-icon v-if="!copied"> content_copy </v-icon>
            <v-icon v-else color="success"> check </v-icon>
          </v-btn>
        </div>
        <!-- Error Banner -->
        <v-alert
          v-if="groupError"
          v-model="groupErrorVisible"
          type="error"
          density="compact"
          closable
          class="mt-2 mb-0"
        >
          <div class="flex items-center gap-2">
            <v-icon size="small">error</v-icon>
            <span>{{ t('multiplayer.connectionError') }}: {{ groupError }}</span>
          </div>
        </v-alert>
        <!-- NAT Warning for Symmetric NAT -->
        <v-alert
          v-if="natType === 'Symmetric NAT' || natType === 'Blocked'"
          type="warning"
          density="compact"
          class="mt-2 mb-0"
        >
          <div class="flex items-center gap-2">
            <v-icon size="small">warning</v-icon>
            <span>{{ t('multiplayer.natWarning') }}</span>
          </div>
        </v-alert>
      </v-card>

      <v-list
        lines="two"
        class="flex flex-col justify-start gap-2 overflow-auto py-2"
        style="width: 100%; background: transparent"
      >
        <template v-if="navigation === 'connections'">
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
        <template v-else>
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
                style="max-width: 105px"
                hide-details
                :items="kernels"
              />
            </template>
          </v-list-item>

          <v-list-item v-if="hasMicrosoft" class="flex-1 flex-grow-0">
            <template #prepend>
              <v-avatar>
                <v-icon>swap_vert</v-icon>
              </v-avatar>
            </template>
            <v-list-item-title>
              {{ t('multiplayer.allowTurn') }}
            </v-list-item-title>
            <v-list-item-subtitle
              v-shared-tooltip="() => t('multiplayer.allowTurnHint')"
              class="flex items-center gap-2"
            >
              {{ t('multiplayer.allowTurnHint') }}
            </v-list-item-subtitle>
            <template #append>
              <v-checkbox v-model="allowTurn" hide-details />
            </template>
          </v-list-item>

          <v-list-item v-if="allowTurn && turnserversItems.length > 0" class="flex-1 flex-grow-0">
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
import { useDateString } from '@/composables/date'
import { AddInstanceDialogKey } from '@/composables/instanceTemplates'
import { kPeerState } from '@/composables/peers'
import { kTheme } from '@/composables/theme'
import { kUserContext } from '@/composables/user'
import { vSharedTooltip } from '@/directives/sharedTooltip'
import { injection } from '@/util/inject'
import { useIntervalFn, useLocalStorage } from '@vueuse/core'
import { AUTHORITY_MICROSOFT, BaseServiceKey } from '@xmcl/runtime-api'
import { useDialog, useSimpleDialog } from '../composables/dialog'
import MultiplayerDialogInitiate from './MultiplayerDialogInitiate.vue'
import MultiplayerDialogReceive from './MultiplayerDialogReceive.vue'

const { show } = useDialog('peer-initiate')
const { show: showShareInstance } = useDialog('share-instance')
const { show: showAddInstasnce } = useDialog(AddInstanceDialogKey)
const { show: showReceive } = useDialog('peer-receive')
const navigation = ref('connections' as 'connections' | 'settings')

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
  groupState,
  icePings,
  groupPing,
  groupLastTimestamp,
  joinGroup,
  leaveGroup,
  drop,
  ips,
  device,
  natType,
  refreshingNatType,
  refreshNatType,
  error: groupError,
} = injection(kPeerState)
const groupErrorVisible = ref(true)
watch(groupError, () => {
  groupErrorVisible.value = true
})
const { t } = useI18n()
const { handleUrl } = useService(BaseServiceKey)
const { users } = injection(kUserContext)
const hasMicrosoft = computed(() => !!users.value.find((u) => u.authority === AUTHORITY_MICROSOFT))
const forwardedPort = ref(0)

const allowTurn = useLocalStorage('peerAllowTurn', false, { writeDefaults: false })
const kernel = useLocalStorage<'node-datachannel' | 'webrtc'>(
  'peerKernel',
  'node-datachannel',
  { writeDefaults: false },
)
const kernels = computed(() => [
  { value: 'node-datachannel', text: 'node-datachannel' },
  { value: 'webrtc', text: 'WebRTC' },
])

function getIceServerPingText(value: number | 'timeout' | undefined) {
  if (value === undefined) return ''
  return ` (${value}ms)`
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

const { getDateString } = useDateString()
const pingAgo = ref('')
const interval = useIntervalFn(
  () => {
    pingAgo.value = `(${getDateString(groupLastTimestamp.value)})`
  },
  1_000,
  { immediate: false },
)

watch(
  groupState,
  (newVal) => {
    if (newVal === 'connected') {
      interval.resume()
    } else {
      interval.pause()
    }
  },
  { immediate: true },
)

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
    joinGroup(groupId.value)
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
