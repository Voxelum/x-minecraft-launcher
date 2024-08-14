<template>
  <div
    style="z-index: 2; overflow: auto"
    class="h-full w-full select-none overflow-auto"
    @dragover.prevent
  >
    <div
      class="flex h-full flex-col gap-2 overflow-auto"
      @dragover.prevent
      @drop="onDrop"
    >
      <v-card
        class="z-5 flex-shrink flex-grow-0 rounded-none px-2 py-1 pb-2"
        tiled
      >
        <div class="flex items-center gap-2">
          <v-progress-circular
            v-if="groupState === 'connecting'"
            indeterminate
            :size="20"
            :width="3"
          />
          {{ tGroupState[groupState] }}

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
            v-shared-tooltip.left="_ => t('multiplayer.share')"
            text
            icon
            @click="showShareInstance()"
          >
            <v-icon>
              share
            </v-icon>
          </v-btn>

          <v-menu
            left
            offset-y
          >
            <template #activator="{ on }">
              <v-btn
                id="manual-connect-button"
                v-shared-tooltip.left="_ => t('multiplayer.manualConnect')"
                text
                icon
                v-on="on"
              >
                <v-icon>
                  build
                </v-icon>
              </v-btn>
            </template>
            <v-list>
              <v-list-item @click="show()">
                <v-list-item-title>
                  <v-icon left>
                    add_call
                  </v-icon>
                  {{ t('multiplayer.initiateConnection') }}
                </v-list-item-title>
              </v-list-item>
              <v-list-item @click="showReceive()">
                <v-list-item-title>
                  <v-icon left>
                    login
                  </v-icon>
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
            hide-details
            dense
            filled
            prepend-inner-icon="group"
            :label="t('multiplayer.groupId')"
            @click="groupState === 'connected' ? onCopy(groupId) : undefined"
          />
          <v-btn
            id="join-group-button"
            v-shared-tooltip="_ => !group ? t('multiplayer.joinOrCreateGroup') : t('multiplayer.leaveGroup')"
            text
            icon
            @click="onJoin()"
          >
            <template v-if="!group">
              <v-icon>
                add
              </v-icon>
            </template>
            <template v-else>
              <v-icon color="red">
                delete
              </v-icon>
            </template>
          </v-btn>
          <v-btn
            v-shared-tooltip.left="_ => copied ? t('multiplayer.copied') : t('multiplayer.copy')"
            :disabled="!group"
            text
            icon
            @click="onCopy(groupId)"
          >
            <v-icon v-if="!copied">
              content_copy
            </v-icon>
            <v-icon
              v-else
              color="success"
            >
              check
            </v-icon>
          </v-btn>
        </div>
      </v-card>

      <v-list
        two-line
        subheader
        class="flex flex-col justify-start gap-2 overflow-auto py-2"
        style="width: 100%; background: transparent;"
      >
        <template v-if="navigation === 'connections'">
          <v-subheader class>
            {{ t("multiplayer.networkInfo") }}
          </v-subheader>
          <v-list-item
            v-if="device"
            class="flex-1 flex-grow-0"
            @click="open(device.modelURL, '_blank')"
          >
            <v-list-item-avatar>
              <v-icon>
                router
              </v-icon>
            </v-list-item-avatar>
            <v-list-item-content>
              <v-list-item-title>
                {{ t("multiplayer.routerInfo") }}
              </v-list-item-title>
              <v-list-item-subtitle class="flex items-center gap-2">
                {{ device.friendlyName }} ({{ device.modelName }})
              </v-list-item-subtitle>
            </v-list-item-content>
            <v-list-item-action class="self-center">
              <v-chip
                label
                outlined
              >
                <v-icon left>
                  precision_manufacturing
                </v-icon>
                <a :href="device.manufacturerURL">
                  {{ device.manufacturer }}
                </a>
              </v-chip>
            </v-list-item-action>
          </v-list-item>
          <v-list-item class="flex-1 flex-grow-0">
            <v-list-item-avatar>
              <v-icon>
                wifi
              </v-icon>
            </v-list-item-avatar>
            <v-list-item-content>
              <v-list-item-title>
                {{ t('multiplayer.currentNatTitle') }}
              </v-list-item-title>
              <v-list-item-subtitle>
                <span>
                  {{ t('multiplayer.currentIpTitle') }}
                </span>
                <v-chip
                  label
                  small
                  outlined
                  @click="hideIp = !hideIp"
                >
                  <v-icon
                    left
                    small
                  >
                    {{ !hideIp ? 'visibility' : 'visibility_off' }}
                  </v-icon>
                  {{ hideIp ? '***.***.***.***' : ips.join(', ') }}
                </v-chip>
                <!-- <span class="font-bold">
                {{ ips.join(', ') }}
              </span> -->
              </v-list-item-subtitle>
            </v-list-item-content>
            <v-list-item-action class="flex flex-shrink flex-grow-0 flex-row self-center">
              <v-tooltip
                bottom
                transition="scroll-y-transition"
                color="black"
              >
                <template #activator="{ on }">
                  <span
                    class="font-bold"
                    :style="{ color: natColors[natType] }"
                    v-on="on"
                  >
                    {{ natIcons[natType] }} {{ tNatType[natType] }}
                  </span>
                </template>

                {{ t('multiplayer.difficultyLevelHint') }}
                <div
                  v-for="(type, key, index) of tNatType"
                  :key="key"
                >
                  {{ index + 1 }}. {{ type }} {{ natIcons[key] }}
                </div>
              </v-tooltip>
            </v-list-item-action>
            <v-list-item-action>
              <v-btn
                icon
                :loading="refreshingNatType"
                @click="refreshNatType"
              >
                <v-icon>refresh</v-icon>
              </v-btn>
            </v-list-item-action>
          </v-list-item>

          <v-subheader class>
            {{ t("multiplayer.connections") }}
          </v-subheader>
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
            <v-progress-linear
              v-if="c.sharing"
              buffer-value="0"
              class="absolute bottom-0"
              stream
            />
            <v-progress-linear
              v-if="c.sharing"
              buffer-value="0"
              class="absolute top-0"
              stream
            />
            <v-list-item-avatar class="mr-4">
              <PlayerAvatar
                :dimension="40"
                :src="c.userInfo.avatar"
              />
            </v-list-item-avatar>
            <v-list-item-content>
              <v-list-item-title>
                {{ c.userInfo.name || c.id }}
              </v-list-item-title>
              <v-list-item-subtitle class="flex items-center gap-2">
                <v-chip
                  label
                  small
                  :color="stateToColor[c.connectionState]"
                >
                  <v-icon left>
                    signal_cellular_alt
                  </v-icon>
                  <span class="hidden lg:inline">
                    {{ t(`peerConnectionState.name`) }}:
                  </span>
                  {{ tConnectionStates[c.connectionState] }}
                  <template v-if="c.connectionState === 'connected'">
                    ({{ c.ping }}ms)
                  </template>
                </v-chip>
              </v-list-item-subtitle>
            </v-list-item-content>
            <v-list-item-action
              v-if="c.selectedCandidate"
              class="mr-5 self-center"
            >
              <v-list-item-subtitle class="flex flex-col">
                <span>
                  <v-icon>
                    place
                  </v-icon>
                  <span class="hidden lg:inline">
                    {{ tTransportType[c.selectedCandidate.local.type] }}
                  </span>
                  {{ c.selectedCandidate.local.address }}:{{ c.selectedCandidate.local.port }}
                </span>
                <span>
                  <v-icon>
                    person_pin_circle
                  </v-icon>
                  <span class="hidden lg:inline">
                    {{ tTransportType[c.selectedCandidate.remote.type] }}
                  </span>
                  {{ c.selectedCandidate.remote.address }}:{{ c.selectedCandidate.remote.port }}
                </span>
              </v-list-item-subtitle>
            </v-list-item-action>
            <v-list-item-action
              v-if="c.signalingState === 'have-local-offer'"
              class="mr-5 self-center"
            >
              <v-list-item-subtitle>
                {{ t('peerSignalingState.have-local-offer') }}
              </v-list-item-subtitle>
            </v-list-item-action>
            <v-list-item-action
              v-if="c.iceGatheringState !== 'complete'"
              class="mr-5 self-center"
            >
              <v-list-item-subtitle>
                <div class="flex flex-grow-0 items-center gap-2">
                  <v-progress-circular
                    indeterminate
                    :size="18"
                    :width="1"
                  />
                  {{ t('peerIceGatheringState.gathering') }}
                </div>
              </v-list-item-subtitle>
            </v-list-item-action>

            <v-list-item-action class="flex flex-grow-0 flex-row gap-2 self-center">
              <template v-if="c.sharing">
                <v-btn
                  v-shared-tooltip="_ => t('multiplayer.sharing')"
                  icon
                  @click="showShareInstance(c.sharing)"
                >
                  <v-icon>
                    download
                  </v-icon>
                </v-btn>
                <v-btn
                  v-if="c.sharing"
                  v-shared-tooltip="_ => t('multiplayer.sharing')"
                  color="primary"
                  icon
                  @click="c.sharing ? showAddInstasnce({
                    type: 'manifest',
                    manifest: c.sharing,
                  }) : undefined"
                >
                  <v-icon>
                    add
                  </v-icon>
                </v-btn>
              </template>

              <v-btn
                v-if="c.connectionState !== 'connected'"
                icon
                @click="edit(c.id, c.initiator)"
              >
                <v-icon>edit</v-icon>
              </v-btn>
            </v-list-item-action>
            <v-btn
              v-shared-tooltip.left="_ => t('multiplayer.disconnect')"
              color="error"
              icon
              @click="showDelete(c.id)"
            >
              <v-icon>link_off</v-icon>
            </v-btn>
          </v-list-item>
        </template>
        <template v-else>
          <v-list-item class="flex-1 flex-grow-0">
            <v-list-item-avatar>
              <v-icon>
                favorite
              </v-icon>
            </v-list-item-avatar>
            <v-list-item-content>
              <v-list-item-title>
                {{ t("multiplayer.kernel") }}
              </v-list-item-title>
              <v-list-item-subtitle v-shared-tooltip="_ => t('multiplayer.kernelDescription')">
                {{ t("multiplayer.kernelDescription") }}
              </v-list-item-subtitle>
            </v-list-item-content>
            <v-list-item-action>
              <v-select
                v-model="kernel"
                filled
                style="max-width: 105px"
                hide-details
                :items="kernels"
              />
            </v-list-item-action>
          </v-list-item>

          <v-list-item
            v-if="hasMicrosoft"
            class="flex-1 flex-grow-0"
          >
            <v-list-item-avatar>
              <v-icon>
                swap_vert
              </v-icon>
            </v-list-item-avatar>
            <v-list-item-content>
              <v-list-item-title>
                {{ t("multiplayer.allowTurn") }}
              </v-list-item-title>
              <v-list-item-subtitle
                v-shared-tooltip="_ => t('multiplayer.allowTurnHint')"
                class="flex items-center gap-2"
              >
                {{ t("multiplayer.allowTurnHint") }}
              </v-list-item-subtitle>
            </v-list-item-content>
            <v-list-item-action>
              <v-checkbox v-model="allowTurn" />
            </v-list-item-action>
          </v-list-item>

          <v-list-item
            v-if="allowTurn && turnserversItems.length > 0"
            class="flex-1 flex-grow-0"
          >
            <v-list-item-avatar>
              <!-- <v-icon>
              swap_vert
            </v-icon> -->
            </v-list-item-avatar>
            <v-list-item-content />
            <v-list-item-action>
              <v-select
                v-model="preferredTurnserver"
                filled
                clearable
                hide-details
                :items="turnserversItems"
                :placeholder="turnserversItems[0].text"
              />
            </v-list-item-action>
          </v-list-item>

          <v-subheader class="mt-2">
            {{ t("multiplayer.exposedPorts") }}
            <v-spacer />
            <v-text-field
              v-model="forwardedPort"
              hide-details
              class="max-w-24"
              filled
              dense
              type="number"
            />
            <v-btn
              icon
              text
              @click="exposePort(forwardedPort, 0)"
            >
              <v-icon>add</v-icon>
            </v-btn>
          </v-subheader>

          <v-list-item
            v-for="port of exposedPorts"
            :key="port"
            class="flex-1 flex-grow-0"
          >
            <v-list-item-content>
              <v-list-item-title>
                {{ port }}
              </v-list-item-title>
              <v-list-item-subtitle>
                {{ t("multiplayer.exposedPortDescription") }}
              </v-list-item-subtitle>
            </v-list-item-content>
            <v-list-item-action>
              <v-btn
                icon
                text
                color="red"
                @click="unexposePort(port)"
              >
                <v-icon>delete</v-icon>
              </v-btn>
            </v-list-item-action>
          </v-list-item>
          <v-list-item
            v-for="port of otherExposedPorts"
            :key="port"
            class="flex-1 flex-grow-0"
          >
            <v-list-item-content>
              <v-list-item-title>
                {{ port.port }}
              </v-list-item-title>
              <v-list-item-subtitle>
                {{ t("multiplayer.otherExposedPortDescription", { user: port.user }) }}
              </v-list-item-subtitle>
            </v-list-item-content>
          </v-list-item>
        </template>
      </v-list>
      <v-bottom-navigation
        v-model="navigation"
        color="primary"
      >
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
<script lang=ts setup>
import Hint from '@/components/Hint.vue'
import PlayerAvatar from '@/components/PlayerAvatar.vue'
import SimpleDialog from '@/components/SimpleDialog.vue'
import { useService } from '@/composables'
import { kPeerState } from '@/composables/peers'
import { kSettingsState } from '@/composables/setting'
import { kTheme } from '@/composables/theme'
import { kUserContext } from '@/composables/user'
import { vSharedTooltip } from '@/directives/sharedTooltip'
import { injection } from '@/util/inject'
import { AUTHORITY_MICROSOFT, BaseServiceKey } from '@xmcl/runtime-api'
import { useDialog, useSimpleDialog } from '../composables/dialog'
import MultiplayerDialogInitiate from './MultiplayerDialogInitiate.vue'
import MultiplayerDialogReceive from './MultiplayerDialogReceive.vue'
import { useLocalStorageCacheBool, useLocalStorageCacheStringValue } from '@/composables/cache'
import { AddInstanceDialogKey } from '@/composables/instanceTemplates'

const { show } = useDialog('peer-initiate')
const { show: showShareInstance } = useDialog('share-instance')
const { show: showAddInstasnce } = useDialog(AddInstanceDialogKey)
const { show: showReceive } = useDialog('peer-receive')
const navigation = ref('connections' as 'connections' | 'settings')

const hideIp = ref(true)

const open = (...args: any[]) => window.open(...args)

const { show: showDelete, target: deleting, confirm: doDelete, model } = useSimpleDialog<string>((v) => {
  if (!v) return
  console.log(`drop connection ${v}`)
  drop(v)
})
const { exposedPorts, exposePort, unexposePort, otherExposedPorts, connections, turnservers, group, groupState, joinGroup, leaveGroup, drop, ips, device, natType, refreshingNatType, refreshNatType } = injection(kPeerState)
const { t } = useI18n()
const { handleUrl } = useService(BaseServiceKey)
const { users } = injection(kUserContext)
const hasMicrosoft = computed(() => !!users.value.find(u => u.authority === AUTHORITY_MICROSOFT))
const forwardedPort = ref(0)

const allowTurn = useLocalStorageCacheBool('peerAllowTurn', false)
const kernel = useLocalStorageCacheStringValue('peerKernel', 'node-datachannel' as 'node-datachannel' | 'webrtc')
const kernels = computed(() => [
  { value: 'node-datachannel', text: 'node-datachannel' },
  { value: 'webrtc', text: 'WebRTC' },
])

const preferredTurnserver = useLocalStorageCacheStringValue('peerPreferredTurn', '')
const turnserversItems = computed(() => Object.entries(turnservers.value).map(([key, value]) => ({ value: key, text: `${tLocale.value[value as string] || value}` })))
const tLocale = computed(() => ({
  liaoning: t('turnRegion.liaoning'),
  guangzhou: t('turnRegion.guangzhou'),
  hk: t('turnRegion.hk'),
  fr: t('turnRegion.fr'),
  po: t('turnRegion.po'),
} as Record<string, string>))

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
const deletingName = computed(() => connections.value.find(c => c.id === deleting.value)?.userInfo.name)
const copied = ref(false)

const joiningGroup = computed(() => groupState.value === 'connecting')

watch(group, (newVal) => {
  if (newVal) {
    groupId.value = newVal
  }
}, { immediate: true })

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

const edit = (id: string, init: boolean) => {
  const conn = connections.value.find(c => c.id === id)
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
    navigator.clipboard.writeText(val)
    copied.value = true
    setTimeout(() => { copied.value = false }, 3_000)
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
