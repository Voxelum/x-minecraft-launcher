<template>
  <div class="flex-1 flex flex-col overflow-hidden px-2 pt-2">
    <!-- Subtabs: Dedicated Servers & Together P2P -->
    <div class="flex items-center justify-between pb-4 border-b border-white/10 mb-4">
      <div class="bp-nav" role="tablist">
        <button
          type="button"
          class="bp-nav-item !px-5 !py-2"
          :class="{ 'active': activeSubtab === 'servers' }"
          role="tab"
          data-gamepad-focusable
          @click="activeSubtab = 'servers'"
        >
          <v-icon size="18">dns</v-icon>
          <span>{{ t('server.serversListTitle') }}</span>
        </button>
        <button
          type="button"
          class="bp-nav-item !px-5 !py-2"
          :class="{ 'active': activeSubtab === 'together' }"
          role="tab"
          data-gamepad-focusable
          @click="activeSubtab = 'together'"
        >
          <v-icon size="18">hub</v-icon>
          <span>Together P2P</span>
          <v-chip
            v-if="groupState === 'connected'"
            size="x-small"
            color="success"
            label
            class="ml-1 font-bold"
          >
            Online
          </v-chip>
        </button>
      </div>

      <div class="flex items-center gap-3">
        <v-btn
          v-if="activeSubtab === 'servers'"
          color="primary"
          prepend-icon="add"
          class="rounded-xl font-bold"
          data-gamepad-focusable
          @click="addServerDialog = true"
        >
          {{ t('server.addServer') }}
        </v-btn>

        <template v-else>
          <v-btn
            variant="tonal"
            prepend-icon="share"
            class="rounded-xl font-bold"
            :disabled="runningClientInstances.length === 0"
            data-gamepad-focusable
            @click="showShareInstance()"
          >
            {{ t('multiplayer.editSharingScope') }}
          </v-btn>
          <v-btn
            variant="tonal"
            prepend-icon="add_call"
            class="rounded-xl font-bold"
            data-gamepad-focusable
            @click="showInitiate()"
          >
            {{ t('multiplayer.initiateConnection') }}
          </v-btn>
          <v-btn
            variant="tonal"
            prepend-icon="login"
            class="rounded-xl font-bold"
            data-gamepad-focusable
            @click="showReceive()"
          >
            {{ t('multiplayer.joinManual') }}
          </v-btn>
        </template>
      </div>
    </div>

    <!-- Servers Section -->
    <div v-if="activeSubtab === 'servers'" class="flex-1 overflow-y-auto custom-scrollbar pb-6">
      <!-- Empty Servers State: Console Hub Hero -->
      <div
        v-if="serverList.length === 0"
        class="relative flex flex-col items-center justify-center py-20 px-6 text-center select-none"
      >
        <!-- Ambient radial glow -->
        <div class="absolute w-72 h-72 rounded-full bg-primary/15 blur-3xl pointer-events-none -z-10" />

        <!-- Server Hub Icon Emblem -->
        <div class="relative w-28 h-28 rounded-3xl bg-gradient-to-br from-white/10 to-white/[0.02] border border-white/15 flex items-center justify-center shadow-[0_12px_40px_rgba(0,0,0,0.6)] mb-6">
          <div class="absolute inset-0 rounded-3xl bg-primary/10 blur-md pointer-events-none" />
          <v-icon size="56" color="primary">dns</v-icon>
        </div>

        <!-- Typography -->
        <h3 class="text-2xl sm:text-3xl font-extrabold text-white tracking-tight mb-2">
          {{ t('server.nameHint') }}
        </h3>
        <p class="text-sm text-white/60 max-w-md mx-auto leading-relaxed mb-8">
          {{ t('server.emptyHint') }}
        </p>

        <!-- Action Buttons -->
        <div class="flex items-center justify-center gap-4 flex-wrap">
          <button
            type="button"
            class="bp-play-btn !px-8 !py-3.5 !h-14 font-extrabold text-base flex items-center gap-3 rounded-2xl shadow-[0_8px_32px_rgba(var(--v-theme-primary),0.4)]"
            tabindex="0"
            data-gamepad-focusable
            @click="addServerDialog = true"
          >
            <span v-if="gamepadConnected" class="bp-glyph bp-glyph--a !text-xs">{{ buttonALabel }}</span>
            <v-icon size="22">add_circle</v-icon>
            <span>{{ t('server.addServer') }}</span>
          </button>

          <button
            type="button"
            class="bp-sec-btn !px-6 !py-3.5 !h-14 font-bold text-base flex items-center gap-2.5 rounded-2xl"
            tabindex="0"
            data-gamepad-focusable
            @click="activeSubtab = 'together'"
          >
            <v-icon size="20" color="primary">hub</v-icon>
            <span>Minecraft Together</span>
          </button>
        </div>
      </div>

      <div v-else class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5 p-4 pt-5 pb-8">
        <div
          v-for="server in serverList"
          :key="server.ip"
          class="bp-subpage-card !p-5 !m-0 flex flex-col justify-between hover:border-primary/50 transition-all duration-200"
          tabindex="0"
          data-gamepad-focusable
        >
          <div class="flex items-start gap-3 mb-4">
            <img
              v-if="server.icon"
              :src="server.icon"
              class="w-12 h-12 rounded-xl object-contain bg-black/40 flex-shrink-0"
              alt="Icon"
            >
            <div v-else class="w-12 h-12 rounded-xl bg-white/10 flex items-center justify-center flex-shrink-0">
              <v-icon size="24" color="primary">dns</v-icon>
            </div>

            <div class="min-w-0 flex-1">
              <div class="font-bold text-base text-white truncate">
                {{ server.name || server.ip }}
              </div>
              <div class="text-xs text-white/60 font-mono truncate">
                {{ server.ip }}
              </div>
            </div>
          </div>

          <div class="flex items-center justify-between pt-3 border-t border-white/10">
            <div class="flex items-center gap-2 text-xs text-white/60">
              <v-icon size="14" color="success">signal_cellular_alt</v-icon>
              <span>Online</span>
            </div>

            <v-btn
              color="primary"
              class="rounded-xl font-bold px-6"
              prepend-icon="play_arrow"
              data-gamepad-focusable
              @click="joinServer(server)"
            >
              <span v-if="gamepadConnected" class="bp-glyph bp-glyph--a !mr-1">{{ buttonALabel }}</span>
              {{ t('launch.launch') }}
            </v-btn>
          </div>
        </div>
      </div>
    </div>

    <!-- Together P2P Section -->
    <div v-else class="flex-1 overflow-y-auto custom-scrollbar flex flex-col gap-6 p-2 pb-6">
      <!-- Room Control Card -->
      <div class="bp-subpage-card !m-0 !p-6 flex flex-col md:flex-row items-center justify-between gap-6">
        <div class="flex items-center gap-4 min-w-0">
          <div class="w-14 h-14 rounded-2xl bg-primary/20 flex items-center justify-center flex-shrink-0">
            <v-icon size="32" color="primary">hub</v-icon>
          </div>
          <div class="min-w-0">
            <div class="flex items-center gap-3">
              <h2 class="text-xl font-bold text-white">
                {{ group ? t('bigPicture.connectedRoom') : t('multiplayer.joinOrCreateGroup') }}
              </h2>
              <v-chip
                size="small"
                label
                :color="groupState === 'connected' ? 'success' : groupState === 'connecting' ? 'primary' : 'default'"
                class="font-bold"
              >
                <v-progress-circular
                  v-if="groupState === 'connecting'"
                  class="mr-2"
                  indeterminate
                  :size="12"
                  :width="2"
                />
                {{ groupStatus === 'waiting-master' ? t('multiplayer.waitingForMaster') : tGroupState[groupState] }}
              </v-chip>
              <v-chip
                v-if="groupState === 'connected'"
                size="small"
                label
                color="primary"
              >
                <v-icon start size="14">{{ groupRole === 'master' ? 'home' : 'person' }}</v-icon>
                {{ groupRole === 'master' ? t('multiplayer.master') : t('multiplayer.member') }}
                <template v-if="groupMaxPeers"> · {{ groupMembers.length }}/{{ groupMaxPeers }}</template>
              </v-chip>
            </div>
            <p class="text-xs text-white/60 mt-1">
              {{ group ? t('multiplayer.copyGroupToFriendHint') : t('multiplayer.joinOrCreateGroupHint') }}
            </p>
          </div>
        </div>

        <!-- Room Input & Join/Leave Actions -->
        <div class="flex items-center gap-3 w-full md:w-auto">
          <v-text-field
            v-model="groupId"
            :placeholder="t('multiplayer.groupId')"
            :readonly="!!group"
            variant="outlined"
            density="compact"
            rounded="xl"
            hide-details
            class="bg-white/5 min-w-[200px]"
            data-gamepad-focusable
          />

          <v-btn
            v-if="group"
            icon
            variant="tonal"
            class="rounded-xl"
            :title="t('bigPicture.copyRoomCode')"
            data-gamepad-focusable
            @click="copyGroup"
          >
            <v-icon :color="copied ? 'success' : undefined">{{ copied ? 'check' : 'content_copy' }}</v-icon>
          </v-btn>

          <v-btn
            :color="group ? 'error' : 'primary'"
            :variant="group ? 'tonal' : 'flat'"
            :prepend-icon="group ? 'logout' : 'group_add'"
            :loading="joiningGroup"
            class="rounded-xl font-bold px-6 h-10"
            data-gamepad-focusable
            @click="onJoinToggle"
          >
            <span v-if="gamepadConnected" class="bp-glyph bp-glyph--a !mr-1">{{ buttonALabel }}</span>
            {{ group ? t('multiplayer.leaveGroup') : t('multiplayer.joinOrCreateGroup') }}
          </v-btn>
        </div>
      </div>

      <!-- Error Alert -->
      <v-alert v-if="groupError" type="error" variant="tonal" density="compact" rounded="xl" closable>
        {{ t('multiplayer.connectionError') }}: {{ groupError }}
      </v-alert>

      <!-- Connected Room Peers / Members List -->
      <div v-if="group && peerItems.length > 0" class="flex flex-col gap-3">
        <div class="text-xs font-bold uppercase tracking-wider text-white/50 px-1">
          {{ t('bigPicture.roomMembers') }} ({{ peerItems.length }})
        </div>

        <div class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          <div
            v-for="peer in peerItems"
            :key="peer.key"
            class="bp-subpage-card !m-0 !p-5 flex items-center justify-between gap-4"
            tabindex="0"
            data-gamepad-focusable
          >
            <div class="flex items-center gap-3 min-w-0">
              <PlayerAvatar
                v-if="peer.connection?.userInfo?.avatar"
                :dimension="44"
                :src="peer.connection.userInfo.avatar"
                class="overflow-hidden rounded-full ring-2 ring-white/20 flex-shrink-0"
              />
              <div v-else class="w-11 h-11 rounded-full bg-primary/20 flex items-center justify-center flex-shrink-0">
                <v-icon size="22" color="primary">
                  {{ peer.member?.peerId === groupMasterPeerId ? 'home' : 'person' }}
                </v-icon>
              </div>

              <div class="flex flex-col min-w-0">
                <div class="font-bold text-white truncate text-sm">
                  {{ peer.member?.displayName || peer.member?.accountId || peer.connection?.userInfo?.name || peer.key }}
                </div>
                <div class="flex items-center gap-2 mt-0.5">
                  <v-chip
                    v-if="peer.member"
                    size="x-small"
                    label
                    :color="peer.member.peerId === groupMasterPeerId ? 'primary' : undefined"
                  >
                    {{ peer.member.peerId === groupMasterPeerId ? t('multiplayer.master') : t('multiplayer.member') }}
                  </v-chip>
                  <span
                    v-if="peer.connection?.connectionState === 'connected'"
                    class="text-xs text-white/50"
                  >
                    {{ peer.connection.ping }}ms
                  </span>
                  <v-chip
                    v-if="peer.lanServer"
                    size="x-small"
                    label
                    color="success"
                  >
                    {{ t('multiplayer.gameAvailable') }}
                  </v-chip>
                </div>
              </div>
            </div>

            <div v-if="peer.lanServer" class="flex-shrink-0">
              <v-btn
                color="primary"
                size="small"
                class="rounded-xl font-bold"
                prepend-icon="login"
                data-gamepad-focusable
                @click="joinPeerGame(peer.lanServer)"
              >
                {{ t('launch.launch') }}
              </v-btn>
            </div>
          </div>
        </div>
      </div>

      <!-- Empty Room State -->
      <div
        v-else-if="group"
        class="flex flex-col items-center justify-center py-16 text-center text-white/50"
      >
        <v-icon size="56" class="mb-3 text-white/30">group</v-icon>
        <h3 class="text-lg font-bold mb-1">{{ t('multiplayer.placeholder') }}</h3>
        <p class="text-xs text-white/40 max-w-sm">
          {{ t('multiplayer.copyGroupToFriendHint') }}
        </p>
      </div>

      <!-- Not Connected State -->
      <div
        v-else
        class="flex flex-col items-center justify-center py-16 text-center text-white/50"
      >
        <v-icon size="64" class="mb-4 text-primary/40">hub</v-icon>
        <h3 class="text-xl font-bold mb-2 text-white">Together P2P Multiplayer</h3>
        <p class="text-sm text-white/60 max-w-md mb-6">
          {{ t('multiplayer.joinOrCreateGroupHint') }}
        </p>
      </div>
    </div>

    <!-- Manual SDP WebRTC Connection Dialogs -->
    <MultiplayerDialogInitiate embedded />
    <MultiplayerDialogReceive embedded />

    <!-- Add Server Dialog -->
    <v-dialog v-model="addServerDialog" max-width="500">
      <div class="bp-subpage-card !m-0 !p-6">
        <h3 class="text-xl font-bold mb-4 flex items-center gap-2">
          <v-icon color="primary">add</v-icon>
          {{ t('server.addServer') }}
        </h3>

        <div class="flex flex-col gap-4 mb-6">
          <v-text-field
            v-model="newServerName"
            :label="t('shared.name')"
            variant="outlined"
            density="compact"
            rounded="lg"
            hide-details
          />
          <v-text-field
            v-model="newServerHost"
            :label="t('server.address')"
            :placeholder="t('server.addressHint')"
            variant="outlined"
            density="compact"
            rounded="lg"
            hide-details
          />
        </div>

        <div class="flex justify-end gap-3">
          <v-btn variant="text" @click="addServerDialog = false">{{ t('shared.cancel') }}</v-btn>
          <v-btn
            color="primary"
            class="rounded-lg font-bold"
            :disabled="!newServerHost"
            @click="onAddServer"
          >
            {{ t('shared.add') }}
          </v-btn>
        </div>
      </div>
    </v-dialog>
  </div>
</template>

<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import { useI18n } from 'vue-i18n'
import PlayerAvatar from '@/components/PlayerAvatar.vue'
import { kInstance } from '@/composables/instance'
import { kInstanceLaunch } from '@/composables/instanceLaunch'
import { kInstanceServerInfo } from '@/composables/instanceServerInfo'
import { kPeerState } from '@/composables/peers'
import { useGamepad } from '@/composables/gamepad'
import { useNotifier } from '@/composables/notifier'
import { useDialog } from '@/composables/dialog'
import { injection } from '@/util/inject'
import { parseServerAddress } from '@xmcl/runtime-api'
import { getVisibleRoomPeerMembers, mergeRoomPeerConnections } from '@/util/multiplayerTogether'
import MultiplayerDialogInitiate from './MultiplayerDialogInitiate.vue'
import MultiplayerDialogReceive from './MultiplayerDialogReceive.vue'

const { t } = useI18n()
const { notify } = useNotifier()
const gamepad = useGamepad()
const gamepadConnected = gamepad.connected
const buttonALabel = gamepad.buttonA

const { path: currentInstancePath } = injection(kInstance)
const { servers: datServers, addServer } = injection(kInstanceServerInfo)
const { launch } = injection(kInstanceLaunch)

const activeSubtab = ref<'servers' | 'together'>('servers')

// Server List
const serverList = computed(() => {
  const result = [] as { name: string; ip: string; icon?: string }[]
  for (const s of datServers.value) {
    result.push({
      name: s.name,
      ip: s.ip || '',
      icon: s.icon,
    })
  }
  return result
})

async function joinServer(server: { ip: string }) {
  try {
    const parsed = parseServerAddress(server.ip)
    if (!parsed) return
    await launch('client', {
      server: {
        host: parsed.host,
        port: parsed.port,
      },
    })
  } catch (e: any) {
    notify({ level: 'error', title: e.message || 'Failed to launch server' })
  }
}

// Add Server
const addServerDialog = ref(false)
const newServerName = ref('')
const newServerHost = ref('')

async function onAddServer() {
  if (!newServerHost.value || !currentInstancePath.value) return
  const parsed = parseServerAddress(newServerHost.value.trim())
  if (!parsed) {
    notify({ level: 'error', title: 'Invalid server address' })
    return
  }
  await addServer({
    instancePath: currentInstancePath.value,
    name: newServerName.value.trim() || parsed.host,
    host: parsed.host,
    port: parsed.port,
  })
  addServerDialog.value = false
  newServerName.value = ''
  newServerHost.value = ''
  notify({ level: 'success', title: 'Server added!' })
}

// Together Peer State
const {
  group,
  groupRole,
  groupSelfPeerId,
  groupMasterPeerId,
  groupMembers,
  groupStatus,
  groupMaxPeers,
  groupState,
  connections,
  otherExposedPorts,
  joinGroup,
  leaveGroup,
  runningClientInstances,
  error: groupError,
} = injection(kPeerState)

const { show: showInitiate } = useDialog('peer-initiate')
const { show: showReceive } = useDialog('peer-receive')
const { show: showShareInstance } = useDialog('share-instance')

const groupId = ref(group.value || '')
const joiningGroup = ref(false)
const copied = ref(false)

watch(group, (v) => {
  if (v) groupId.value = v
}, { immediate: true })

const tGroupState = computed(() => ({
  connected: t('peerGroupState.connected'),
  connecting: t('peerGroupState.connecting'),
  closed: t('peerGroupState.closed'),
  closing: t('peerGroupState.closing'),
}))

async function onJoinToggle() {
  if (group.value) {
    leaveGroup()
    return
  }
  if (!groupId.value) return
  joiningGroup.value = true
  try {
    await joinGroup(groupId.value)
  } catch (e: any) {
    notify({ level: 'error', title: e?.message || 'Failed to join group' })
  } finally {
    joiningGroup.value = false
  }
}

async function copyGroup() {
  if (!groupId.value) return
  try {
    await navigator.clipboard.writeText(groupId.value)
    copied.value = true
    notify({ level: 'success', title: t('bigPicture.roomCodeCopied') })
    setTimeout(() => { copied.value = false }, 2000)
  } catch {}
}

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
      lanServer: connection
        ? otherExposedPorts.value.find(({ session }) => session === connection.id)
        : undefined,
    }
  })
})

async function joinPeerGame(lanServer: any) {
  try {
    await launch('client', {
      server: {
        host: '127.0.0.1',
        port: lanServer.port,
      },
    })
  } catch (e: any) {
    notify({ level: 'error', title: e?.message || 'Failed to connect to LAN game' })
  }
}
</script>
