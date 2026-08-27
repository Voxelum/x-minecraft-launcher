<template>
  <div
    data-testid="multiplayer-page"
    class="multiplayer-desktop h-full min-h-0 w-full select-none"
    @dragover.prevent
    @drop="onDrop"
  >
    <aside class="desktop-rail workspace-side-panel">
      <div>
        <div class="rail-brand">
          <v-avatar color="primary" variant="tonal" size="38">
            <v-icon>hub</v-icon>
          </v-avatar>
          <div>
            <div class="text-subtitle-1 font-weight-bold">Together</div>
            <div class="text-caption text-medium-emphasis">P2P Workspace</div>
          </div>
        </div>

        <v-list nav density="comfortable" bg-color="transparent" color="primary" class="rail-nav">
          <v-list-item
            :active="section === 'connections'"
            prepend-icon="group"
            :title="t('multiplayer.connections')"
            @click="section = 'connections'"
          />
          <v-list-item
            :active="section === 'settings'"
            prepend-icon="tune"
            :title="t('setting.name')"
            @click="section = 'settings'"
          />
          <v-list-item
            :active="section === 'billing'"
            prepend-icon="payments"
            :title="t('multiplayer.billing')"
            @click="section = 'billing'"
          />
        </v-list>
      </div>

      <div class="rail-network">
        <div class="text-overline text-medium-emphasis">
          {{ t('multiplayer.currentNatTitle') }}
        </div>
        <div class="rail-network-row mt-1 flex items-center gap-2 font-weight-medium">
          <span>{{ natIcons[natType] }}</span>
          <span>{{ tNatType[natType] }}</span>
          <v-btn
            class="ml-auto"
            :aria-label="t('shared.refresh')"
            icon="refresh"
            size="x-small"
            variant="text"
            :loading="refreshingNatType"
            @click="refreshNatType"
          />
        </div>
        <button
          v-if="device"
          class="rail-router mt-2"
          :disabled="!device.modelURL"
          @click="openRouter"
        >
          <v-icon size="18">router</v-icon>
          <span class="min-w-0">
            <span class="block truncate text-caption font-weight-medium">{{ device.friendlyName }}</span>
            <span class="block truncate text-caption text-medium-emphasis">{{ device.modelName }}</span>
          </span>
        </button>
        <button class="rail-ip mt-3" @click="hideIp = !hideIp">
          <span class="text-caption text-medium-emphasis">{{ t('multiplayer.currentIpTitle') }}</span>
          <span class="truncate text-body-2 font-weight-medium">
            {{ hideIp ? '***.***.***.***' : ips.join(', ') || '-' }}
          </span>
        </button>
        <div v-if="relayAllowance" class="rail-relay mt-3">
          <div class="flex items-center gap-2 text-caption text-success">
            <v-icon size="16">cloud_done</v-icon>
            <span>{{ t('multiplayer.relayServiceAvailable') }}</span>
          </div>
          <div class="mt-1 text-caption font-weight-medium">
            {{ formatBytes(relayAllowance.remaining) }} / {{ formatBytes(relayAllowance.included) }}
          </div>
        </div>
        <div v-if="hasTogetherHome" class="rail-support mt-3">
          <div class="text-caption text-medium-emphasis">
            {{ t('multiplayer.togetherSupportHint') }}
          </div>
          <v-btn
            class="mt-2"
            density="compact"
            href="https://discord.gg/W5XVwYY7GQ"
            prepend-icon="xmcl:discord"
            target="browser"
            variant="tonal"
          >
            {{ t('multiplayer.joinDiscord') }}
          </v-btn>
        </div>
      </div>
    </aside>

    <div class="desktop-main">
      <section class="join-panel">
        <div class="join-heading">
          <div>
            <div class="flex items-center gap-2">
              <h1 class="text-h6 font-weight-bold">
                {{ group ? t('multiplayer.connections') : t('multiplayer.joinOrCreateGroup') }}
              </h1>
              <v-chip size="small" label :color="groupState === 'connected' ? 'success' : undefined">
                <v-progress-circular
                  v-if="groupState === 'connecting'"
                  class="mr-2"
                  indeterminate
                  :size="14"
                  :width="2"
                />
                {{ groupStatus === 'waiting-master' ? t('multiplayer.waitingForMaster') : tGroupState[groupState] }}
              </v-chip>
            </div>
            <div class="text-body-2 text-medium-emphasis">
              {{ group ? t('multiplayer.copyGroupToFriendHint') : t('multiplayer.joinOrCreateGroupHint') }}
            </div>
          </div>
          <div class="flex items-center gap-2">
            <v-btn
              variant="tonal"
              prepend-icon="share"
              :disabled="runningClientInstances.length === 0"
              @click="showShareInstance()"
            >
              {{ t('multiplayer.editSharingScope') }}
            </v-btn>
            <v-menu location="bottom end">
              <template #activator="{ props }">
                <v-btn v-bind="props" variant="tonal" prepend-icon="build">
                  {{ t('multiplayer.manualConnect') }}
                </v-btn>
              </template>
              <v-list>
                <v-list-item prepend-icon="add_call" :title="t('multiplayer.initiateConnection')" @click="showInitiate()" />
                <v-list-item prepend-icon="login" :title="t('multiplayer.joinManual')" @click="showReceive()" />
              </v-list>
            </v-menu>
          </div>
        </div>

        <div class="join-controls">
          <v-text-field
            v-model="groupId"
            data-testid="multiplayer-group-id"
            density="comfortable"
            variant="outlined"
            hide-details
            prepend-inner-icon="group"
            :label="t('multiplayer.groupId')"
            :readonly="!!group"
            @click="group ? copyGroup() : undefined"
          />
          <v-btn
            data-testid="multiplayer-join"
            color="primary"
            :variant="group ? 'tonal' : 'flat'"
            :prepend-icon="group ? 'logout' : 'group_add'"
            :loading="joiningGroup"
            @click="onJoin"
          >
            {{ group ? t('multiplayer.leaveGroup') : t('multiplayer.joinOrCreateGroup') }}
          </v-btn>
          <v-btn
            icon
            variant="text"
            :disabled="!group || groupState !== 'connected'"
            @click="copyGroup"
          >
            <v-icon :color="copied ? 'success' : undefined">{{ copied ? 'check' : 'content_copy' }}</v-icon>
          </v-btn>
        </div>

        <v-alert v-if="groupError" class="mt-3" density="compact" type="error" closable>
          {{ t('multiplayer.connectionError') }}: {{ groupError }}
        </v-alert>
        <v-alert
          v-if="showTogetherRecommendation"
          class="mt-3"
          density="compact"
          type="warning"
          :icon="false"
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
              class="flex-shrink-0"
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
      </section>

      <section class="content-panel">
        <template v-if="section === 'connections'">
          <div class="panel-heading">
            <div>
              <h2 class="text-h6 font-weight-bold">{{ t('multiplayer.connections') }}</h2>
              <div class="text-body-2 text-medium-emphasis">{{ t('multiplayer.placeholder') }}</div>
            </div>
            <div class="flex items-center gap-2">
              <v-chip label size="small">{{ peerItems.length }}</v-chip>
            </div>
          </div>

          <div v-if="peerItems.length" class="connection-list">
            <v-alert v-if="joinError" class="mb-3" density="compact" type="error" closable @click:close="joinError = ''">
              {{ joinError }}
            </v-alert>
            <div v-for="peer in peerItems" :key="peer.key" class="connection-row">
              <PlayerAvatar
                v-if="peer.connection?.userInfo.avatar"
                :dimension="40"
                :src="peer.connection.userInfo.avatar"
              />
              <v-avatar v-else size="40" color="primary" variant="tonal">
                <v-icon size="20">{{ peer.member?.peerId === groupMasterPeerId ? 'home' : 'person' }}</v-icon>
              </v-avatar>
              <div class="min-w-0 flex-1">
                <div class="truncate font-weight-medium">
                  {{ peer.member?.displayName || peer.member?.accountId || peer.connection?.userInfo.name || peer.key }}
                </div>
                <div class="mt-1 flex flex-wrap items-center gap-2">
                  <v-chip
                    v-if="peer.member"
                    size="x-small"
                    label
                    :color="peer.member.peerId === groupMasterPeerId ? 'primary' : undefined"
                  >
                    <v-icon start>{{ peer.member.peerId === groupMasterPeerId ? 'home' : 'person' }}</v-icon>
                    {{ peer.member.peerId === groupMasterPeerId ? t('multiplayer.master') : t('multiplayer.member') }}
                  </v-chip>
                  <v-chip
                    v-if="peer.connectionState && peer.connectionState !== 'connecting' && peer.connectionState !== 'new'"
                    size="x-small"
                    label
                    :color="stateToColor[peer.connectionState]"
                  >
                    <v-icon start>signal_cellular_alt</v-icon>
                    {{ tConnectionStates[peer.connectionState] }}
                  </v-chip>
                  <v-chip
                    v-if="peer.connection?.selectedCandidate"
                    size="x-small"
                    label
                    :color="isRelay(peer.connection) ? 'warning' : 'success'"
                  >
                    {{ isRelay(peer.connection) ? t('multiplayer.relayConnection') : t('multiplayer.directConnection') }}
                  </v-chip>
                  <span
                    v-if="peer.connection?.connectionState === 'connected'"
                    class="text-caption text-medium-emphasis"
                  >
                    {{ peer.connection.ping }}ms
                  </span>
                  <v-chip v-if="peer.lanServer" size="x-small" label color="success">
                    <v-icon start>sports_esports</v-icon>
                    {{ t('multiplayer.gameAvailable') }}
                  </v-chip>
                </div>
              </div>
              <v-progress-circular
                v-if="!peer.connectionState || peer.connectionState === 'connecting' || peer.connectionState === 'new'"
                indeterminate
                :size="20"
                :width="2"
              />
              <v-btn
                v-if="peer.lanServer"
                color="primary"
                prepend-icon="login"
                size="small"
                variant="tonal"
                :disabled="!peer.connection?.sharing || isJoinedGameRunning(peer.connection?.id)"
                :loading="joiningSession === peer.connection?.id"
                @click="peer.connection && joinPeerGame(peer.connection, peer.lanServer, peer.member?.accountId)"
              >
                {{ t('multiplayer.joinGame') }}
              </v-btn>
              <v-btn
                v-if="peer.connection && peer.connection.connectionState !== 'connected'"
                icon="edit"
                size="small"
                variant="text"
                @click="edit(peer.connection.id, peer.connection.initiator)"
              />
              <v-btn
                v-if="peer.connection"
                icon="link_off"
                size="small"
                variant="text"
                color="error"
                @click="showDelete(peer.connection.id)"
              />
            </div>
          </div>

          <Hint
            v-else
            class="connection-empty"
            icon="sports_kabaddi"
            :size="64"
            :text="t('multiplayer.placeholder')"
          />
        </template>

        <template v-else-if="section === 'settings'">
          <div class="panel-heading">
            <div>
              <h2 class="text-h6 font-weight-bold">{{ t('setting.name') }}</h2>
              <div class="text-body-2 text-medium-emphasis">WebRTC transport and local port forwarding</div>
            </div>
          </div>
          <div class="settings-list">
            <SettingItemSelect
              v-model="multiplayerTransport"
              :title="t('setting.multiplayerTransport')"
              :description="t('setting.multiplayerTransportDescription')"
              :items="multiplayerTransportItems"
            />
            <v-divider />
            <SettingItem
              :title="t('multiplayer.routerInfo')"
              :description="device ? `${device.friendlyName} (${device.modelName})` : '-'"
            >
              <template #action>
                <div class="flex items-center gap-2">
                  <v-chip v-if="device?.manufacturer" label variant="outlined">
                    <v-icon start>precision_manufacturing</v-icon>
                    {{ device.manufacturer }}
                  </v-chip>
                  <v-btn
                    v-if="device?.modelURL"
                    :aria-label="t('multiplayer.routerInfo')"
                    icon="open_in_new"
                    size="small"
                    variant="text"
                    @click="openRouter"
                  />
                  <v-btn
                    :aria-label="t('shared.refresh')"
                    icon="refresh"
                    size="small"
                    variant="text"
                    :loading="refreshingNatType"
                    @click="refreshNatType"
                  />
                </div>
              </template>
            </SettingItem>
            <v-divider />
            <SettingItem v-if="turnserverItems.length" :title="t('multiplayer.relayServiceAvailable')">
              <template #action>
                <v-select
                  v-model="preferredTurnserver"
                  class="w-64"
                  variant="outlined"
                  density="compact"
                  hide-details
                  clearable
                  item-title="text"
                  :items="turnserverItems"
                />
              </template>
            </SettingItem>
            <v-divider v-if="turnserverItems.length" />
            <SettingItem :title="t('multiplayer.exposedPorts')" :description="t('multiplayer.exposedPortDescription')">
              <template #action>
                <div class="flex items-center gap-2">
                  <v-text-field v-model.number="forwardedPort" class="w-28" variant="outlined" density="compact" hide-details type="number" />
                  <v-btn icon="add" variant="tonal" size="small" @click="exposePort(forwardedPort, 0)" />
                </div>
              </template>
            </SettingItem>
            <div v-for="port in exposedPorts" :key="port" class="port-row">
              <span>{{ port }}</span>
              <v-btn icon="delete" size="small" variant="text" color="error" @click="unexposePort(port)" />
            </div>
          </div>
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
      </section>
    </div>

    <MultiplayerDialogInitiate embedded />
    <MultiplayerDialogReceive embedded />
    <SimpleDialog
      v-model="deleteModel"
      :title="t('multiplayer.disconnected')"
      :persistent="false"
      :width="400"
      confirm-icon="link_off"
      :confirm="t('multiplayer.confirm')"
      @confirm="doDelete"
    >
      {{ t('multiplayer.disconnectDescription', { user: deletingName, id: deleting }) }}
    </SimpleDialog>
    <SimpleDialog
      v-model="updateInstanceModel"
      :title="t('multiplayer.updateSharedInstanceTitle')"
      :persistent="true"
      :width="440"
      color="primary"
      confirm-icon="sync"
      :confirm="t('multiplayer.updateSharedInstanceConfirm')"
      @confirm="confirmUpdateInstance"
      @cancel="cancelUpdateInstance"
    >
      {{ t('multiplayer.updateSharedInstanceDescription', { instance: updatingInstance?.instanceName }) }}
    </SimpleDialog>
  </div>
</template>

<script lang="ts" setup>
import Hint from '@/components/Hint.vue'
import PlayerAvatar from '@/components/PlayerAvatar.vue'
import SettingItem from '@/components/SettingItem.vue'
import SettingItemSelect from '@/components/SettingItemSelect.vue'
import SimpleDialog from '@/components/SimpleDialog.vue'
import { useService } from '@/composables'
import { useRendererCommandHost } from '@/composables/commandHost'
import { kInstanceLaunchCoordinator } from '@/composables/instanceLaunchCoordinator'
import { kInstances } from '@/composables/instances'
import { kPeerState } from '@/composables/peers'
import { useSettings } from '@/composables/setting'
import { getErrorMessage } from '@/util/error'
import { injection } from '@/util/inject'
import { generateBaseName, generateDistinctName } from '@/util/instanceName'
import {
  findInstanceManifestMatch,
  getPeerInstanceUpdateCandidate,
  getTogetherRecommendationAction,
  getVisibleRoomPeerMembers,
  hasLongConnectionProblem,
  isProblematicNatType,
  isWaffoCheckoutUrl,
  mergeRoomPeerConnections,
  shouldRecommendTogether,
  updateConnectionProblemSince,
} from '@/util/multiplayerTogether'
import { useEventListener, useIntervalFn, useLocalStorage } from '@vueuse/core'
import { BaseServiceKey, InstanceInstallServiceKey, InstanceManifestServiceKey, InstanceServiceKey, XmclAccountServiceKey, type Peer, type XmclTogetherOrder, type XmclTogetherOverview } from '@xmcl/runtime-api'
import { useDialog, useSimpleDialog } from '../composables/dialog'
import MultiplayerBilling from './MultiplayerBilling.vue'
import MultiplayerDialogInitiate from './MultiplayerDialogInitiate.vue'
import MultiplayerDialogReceive from './MultiplayerDialogReceive.vue'

const section = ref<'connections' | 'settings' | 'billing'>('connections')
const { t, locale } = useI18n()
const { handleUrl } = useService(BaseServiceKey)
const togetherService = useService(XmclAccountServiceKey)
const { show: showInitiate } = useDialog('peer-initiate')
const { show: showReceive } = useDialog('peer-receive')
const { show: showShareInstance } = useDialog('share-instance')
const { multiplayerTransport } = useSettings()
const { instances } = injection(kInstances)
const { isRunning, launch } = injection(kInstanceLaunchCoordinator)
const commandHost = useRendererCommandHost()
const { createInstance, editInstance } = useService(InstanceServiceKey)
const { installInstanceFiles } = useService(InstanceInstallServiceKey)
const { getInstanceManifest } = useService(InstanceManifestServiceKey)
const multiplayerTransportItems = [
  { text: 'WebRTC', value: 'webrtc' },
  { text: 'node-datachannel', value: 'node-datachannel' },
]

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
  groupMembers,
  groupStatus,
  groupMaxPeers,
  groupState,
  groupMasterPeerId,
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

const groupId = ref(group.value || '')
const copied = ref(false)
const hideIp = ref(true)
const forwardedPort = ref(0)
const preferredTurnserver = useLocalStorage('peerPreferredTurn', '', { writeDefaults: false })
const joiningGroup = ref(false)
const joiningSession = ref('')
const joinedInstancePaths = reactive<Record<string, string>>({})
const isJoinedGameRunning = (connectionId?: string) => !!connectionId &&
  !!joinedInstancePaths[connectionId] &&
  (
    isRunning(joinedInstancePaths[connectionId]) ||
    runningClientInstances.value.includes(joinedInstancePaths[connectionId])
  )
const joinError = ref('')

const peerItems = computed(() => {
  const roomMemberIds = new Set(groupMembers.value.map(({ peerId }) => peerId))
  const visibleMembers = getVisibleRoomPeerMembers(
    groupMembers.value,
    groupSelfPeerId.value,
    groupMasterPeerId.value,
  )
  const visibleMemberIds = new Set(visibleMembers.map(({ peerId }) => peerId))
  const visibleConnections = connections.value.filter((connection) =>
    !connection.remoteId ||
    !roomMemberIds.has(connection.remoteId) ||
    visibleMemberIds.has(connection.remoteId),
  )
  return mergeRoomPeerConnections(visibleMembers, visibleConnections).map((peer) => {
    const { member, connection } = peer
    return {
      ...peer,
      member,
      connection,
      connectionState: connection?.connectionState,
      lanServer: connection
        ? otherExposedPorts.value.find(({ session }) => session === connection.id)
        : undefined,
    }
  })
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

watch(group, (value) => {
  if (value) groupId.value = value
}, { immediate: true })

const natIcons = computed(() => ({
  Blocked: '⛔',
  'Open Internet': '🌐',
  'Full Cone': '🍦',
  'Restrict NAT': '⭕',
  'Restrict Port NAT': '🛑',
  'Symmetric UDP Firewall': '🧱',
  'Symmetric NAT': '↔️',
  Unknown: '❓',
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
const tGroupState = computed(() => ({
  connected: t('peerGroupState.connected'),
  connecting: t('peerGroupState.connecting'),
  closed: t('peerGroupState.closed'),
  closing: t('peerGroupState.closing'),
}))
const tConnectionStates = computed(() => ({
  closed: t('peerConnectionState.closed'),
  connected: t('peerConnectionState.connected'),
  connecting: t('peerConnectionState.connecting'),
  disconnected: t('peerConnectionState.disconnected'),
  failed: t('peerConnectionState.failed'),
  new: t('peerConnectionState.new'),
}))
const stateToColor: Record<string, string> = {
  connected: 'success',
  connecting: 'primary',
  disconnected: 'error',
  failed: 'error',
  closed: 'secondary',
}
const isRelay = (connection: (typeof connections.value)[number]) =>
  connection.selectedCandidate?.local.type === 'relay' || connection.selectedCandidate?.remote.type === 'relay'

async function joinPeerGame(
  connection: Peer,
  server: { port: number },
  accountId?: string,
) {
  if (!connection.sharing || joiningSession.value) return
  joiningSession.value = connection.id
  joinError.value = ''
  try {
    const manifest = connection.sharing
    const upstream = {
      type: 'peer' as const,
      id: accountId || '',
      ...(accountId ? { accountId } : {}),
      ...(manifest.fingerprint ? { fingerprint: manifest.fingerprint } : {}),
    }
    const matchedInstance = await findInstanceManifestMatch(
      instances.value,
      manifest,
      accountId,
      (candidate) => getInstanceManifest({ path: candidate.path }),
    )
    let instancePath = matchedInstance?.path
    if (matchedInstance) {
      if (
        matchedInstance.upstream?.type === 'peer' &&
        (!matchedInstance.upstream.accountId || matchedInstance.upstream.accountId === accountId) &&
        (
          matchedInstance.upstream.accountId !== upstream.accountId ||
          matchedInstance.upstream.fingerprint !== upstream.fingerprint
        )
      ) {
        await editInstance({ instancePath: matchedInstance.path, upstream })
      }
    }
    if (!instancePath) {
      const updateCandidate = getPeerInstanceUpdateCandidate(instances.value, manifest, accountId)
      if (updateCandidate) {
        const confirmed = await requestInstanceUpdate(updateCandidate.name)
        if (!confirmed) return
        await installInstanceFiles({
          path: updateCandidate.path,
          files: JSON.parse(JSON.stringify(manifest.files)),
          upstream,
        })
        await editInstance({ instancePath: updateCandidate.path, upstream })
        instancePath = updateCandidate.path
      }
    }
    if (!instancePath) {
      const name = generateDistinctName(
        manifest.name || generateBaseName(manifest.runtime),
        instances.value.map((instance) => instance.name),
      )
      instancePath = await createInstance({
        name,
        description: manifest.description,
        runtime: { ...manifest.runtime },
        vmOptions: manifest.vmOptions ? [...manifest.vmOptions] : undefined,
        mcOptions: manifest.mcOptions ? [...manifest.mcOptions] : undefined,
        minMemory: manifest.minMemory,
        maxMemory: manifest.maxMemory,
        upstream,
      })
      await installInstanceFiles({
        path: instancePath,
        files: JSON.parse(JSON.stringify(manifest.files)),
        upstream,
      })
    }
    joinedInstancePaths[connection.id] = instancePath
    const pid = await launch(instancePath, () => commandHost.dispatch('instance.launch', {
      instance: instancePath,
      server: { host: '127.0.0.1', port: server.port },
    }))
    if (typeof pid !== 'number') delete joinedInstancePaths[connection.id]
  } catch (error) {
    delete joinedInstancePaths[connection.id]
    joinError.value = getErrorMessage(error)
  } finally {
    joiningSession.value = ''
  }
}

async function onJoin() {
  if (joiningGroup.value) return
  joiningGroup.value = true
  try {
    if (group.value) {
      await leaveGroup()
    } else {
      const roomId = groupId.value.trim()
      if (roomId) await joinGroup(roomId)
      else await createGroup()
    }
  } finally {
    joiningGroup.value = false
  }
}
function copyGroup() {
  if (!groupId.value) return
  windowController.writeClipboard(groupId.value)
  copied.value = true
  setTimeout(() => { copied.value = false }, 3_000)
}
function edit(id: string, initiator: boolean) {
  if (initiator) showInitiate(id)
  else showReceive(id)
}
function onDrop(event: DragEvent) {
  const url = event.dataTransfer?.getData('xmcl/url')
  if (url) handleUrl(url)
}
function openRouter() {
  if (device.value?.modelURL) open(device.value.modelURL, '_blank')
}

const {
  show: showDelete,
  target: deleting,
  confirm: doDelete,
  model: deleteModel,
} = useSimpleDialog<string>((id) => {
  if (id) drop(id)
})
const deletingName = computed(() => connections.value.find((connection) => connection.id === deleting.value)?.userInfo.name)

type InstanceUpdateConfirmation = {
  instanceName: string
}
let resolveInstanceUpdate: ((confirmed: boolean) => void) | undefined
const {
  show: showUpdateInstance,
  target: updatingInstance,
  confirm: confirmUpdateInstance,
  cancel: cancelUpdateInstance,
  model: updateInstanceModel,
} = useSimpleDialog<InstanceUpdateConfirmation>(
  () => {
    resolveInstanceUpdate?.(true)
    resolveInstanceUpdate = undefined
  },
  () => {
    resolveInstanceUpdate?.(false)
    resolveInstanceUpdate = undefined
  },
)
function requestInstanceUpdate(instanceName: string) {
  return new Promise<boolean>((resolve) => {
    resolveInstanceUpdate?.(false)
    resolveInstanceUpdate = resolve
    showUpdateInstance({ instanceName })
  })
}
onScopeDispose(() => {
  resolveInstanceUpdate?.(false)
  resolveInstanceUpdate = undefined
})

const togetherOverview = shallowRef<XmclTogetherOverview>()
const togetherOrder = shallowRef<XmclTogetherOrder>()
const togetherLoading = ref(false)
const togetherError = shallowRef<unknown>()
async function runTogether(action: () => Promise<void>) {
  if (togetherLoading.value) return
  togetherLoading.value = true
  togetherError.value = undefined
  try { await action() } catch (error) { togetherError.value = error } finally { togetherLoading.value = false }
}
function refreshTogether() {
  return runTogether(async () => {
    if (togetherOrder.value?.status === 'pending') togetherOrder.value = await togetherService.getTogetherOrder(togetherOrder.value.orderId)
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
const togetherRecommendationAction = computed(() =>
  getTogetherRecommendationAction(togetherOverview.value?.trial.status),
)
const showTogetherRecommendation = computed(() =>
  shouldRecommendTogether({
    problematicNat: hasProblematicNat.value,
    isMaster: groupRole.value === 'master',
    longConnectionProblem: hasLongRoomConnectionProblem.value,
    trialStatus: togetherOverview.value?.trial.status,
    subscriptionStatus: togetherOverview.value?.subscription?.status,
  }),
)
function onTogetherAction() {
  if (togetherRecommendationAction.value === 'try') {
    void claimTogetherTrial()
  } else {
    section.value = 'billing'
  }
}
onMounted(() => {
  void refreshTogether()
  void refreshNatType()
})
useEventListener(window, 'focus', () => {
  if (togetherOrder.value?.status === 'pending') void refreshTogether()
})

const relayAllowance = computed(() =>
  togetherOverview.value?.subscription?.status === 'active'
    ? togetherOverview.value.allowances.turnEgressBytes
    : undefined,
)
const hasTogetherHome = computed(() =>
  togetherOverview.value?.subscription?.status === 'active',
)
const turnserverItems = computed(() => Object.entries(turnservers.value).map(([value, text]) => ({ value, text })))
function formatBytes(bytes: number) {
  const units = ['B', 'KB', 'MB', 'GB', 'TB']
  const index = bytes > 0 ? Math.min(Math.floor(Math.log(bytes) / Math.log(1000)), units.length - 1) : 0
  return `${new Intl.NumberFormat(locale.value, { maximumFractionDigits: 2 }).format(bytes / 1000 ** index)} ${units[index]}`
}
</script>

<style scoped>
.multiplayer-desktop {
  --workspace-side-panel-width: 280px;
  display: grid;
  grid-template-columns: var(--workspace-side-panel-width) minmax(0, 1fr);
  overflow: hidden;
}

.desktop-rail {
  display: flex;
  min-height: 0;
  flex-direction: column;
  justify-content: space-between;
  padding: 18px 12px 14px;
}

.rail-brand {
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 0 8px 18px;
}

.rail-nav {
  padding: 0;
}

.rail-network {
  padding: 14px 10px 4px;
  border-top: 1px solid rgba(var(--v-border-color), var(--v-border-opacity));
}

.rail-network-row {
  min-height: 34px;
  padding: 6px 8px;
  border-radius: 6px;
  background: rgba(var(--v-theme-on-surface), 0.035);
}

.rail-router {
  appearance: none;
  display: flex;
  width: 100%;
  min-width: 0;
  align-items: center;
  gap: 8px;
  padding: 7px 8px;
  border: 0;
  border-radius: 6px;
  background: transparent;
  color: inherit;
  font: inherit;
  text-align: left;
  cursor: pointer;
}

.rail-router:hover:not(:disabled),
.rail-router:focus-visible {
  background: rgba(var(--v-theme-on-surface), 0.06);
}

.rail-router:disabled {
  cursor: default;
}

.rail-ip {
  appearance: none;
  display: flex;
  width: 100%;
  min-width: 0;
  flex-direction: column;
  align-items: flex-start;
  padding: 7px 8px;
  border: 0;
  border-radius: 6px;
  background: transparent;
  color: inherit;
  font: inherit;
  text-align: left;
  cursor: pointer;
  transition: background-color 0.15s ease;
}

.rail-ip:hover,
.rail-ip:focus-visible {
  background: rgba(var(--v-theme-on-surface), 0.06);
}

.rail-ip:focus-visible {
  outline: 2px solid rgb(var(--v-theme-primary));
  outline-offset: 1px;
}

.rail-relay {
  padding: 9px 10px;
  border: 1px solid rgba(var(--v-theme-success), 0.28);
  border-radius: 6px;
  background: rgba(var(--v-theme-success), 0.08);
}

.rail-support {
  padding: 9px 10px;
  border-left: 2px solid rgb(var(--v-theme-primary));
  background: rgba(var(--v-theme-primary), 0.06);
}

.desktop-main {
  display: grid;
  min-width: 0;
  min-height: 0;
  grid-template-rows: auto minmax(0, 1fr);
  gap: 12px;
  padding: 12px;
  overflow: hidden;
}

.join-panel {
  min-width: 0;
  border: 1px solid rgba(var(--v-border-color), var(--v-border-opacity));
  border-radius: 8px;
  background: rgba(var(--v-theme-surface), 0.86);
}

.join-panel {
  padding: 18px 20px;
}

.join-heading,
.panel-heading {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 16px;
}

.join-controls {
  display: grid;
  align-items: center;
  grid-template-columns: minmax(240px, 1fr) auto auto;
  gap: 10px;
  margin-top: 16px;
}

.content-panel {
  min-width: 0;
  min-height: 0;
  padding: 6px 8px 18px;
  overflow: auto;
}

.connection-list {
  display: grid;
  gap: 8px;
  margin-top: 16px;
}
.connection-row,
.port-row {
  display: flex;
  min-width: 0;
  align-items: center;
  gap: 12px;
  padding: 11px 12px;
  border: 1px solid rgba(var(--v-border-color), calc(var(--v-border-opacity) * 0.75));
  border-radius: 6px;
}

.connection-empty {
  min-height: 150px;
  margin-top: 16px;
}

.settings-list {
  margin-top: 14px;
}

.port-row {
  margin: 6px 16px;
  justify-content: space-between;
}

@media (max-width: 920px) {
  .multiplayer-desktop {
    --workspace-side-panel-width: 220px;
  }

  .desktop-main {
    gap: 8px;
    padding: 8px;
  }

  .join-panel {
    padding: 12px 14px;
  }

  .content-panel {
    padding: 4px 6px 12px;
  }

  .rail-brand .text-caption {
    display: none;
  }

}

@media (max-height: 520px) {
  .desktop-rail {
    padding-top: 10px;
  }

  .rail-brand {
    padding-bottom: 8px;
  }

  .rail-network .rail-router,
  .rail-network .rail-ip,
  .rail-network .rail-relay {
    display: none;
  }

  .join-panel {
    padding-top: 10px;
    padding-bottom: 10px;
  }

  .join-heading .text-body-2 {
    display: none;
  }

  .join-controls {
    margin-top: 8px;
  }
}
</style>
