<template>
  <v-container
    fluid
    style="z-index: 2; overflow: auto"
    class="overflow-auto h-full"
    @dragover.prevent
  >
    <v-layout
      class="overflow-auto h-full flex-col gap-2"
      @dragover.prevent
      @drop="onDrop"
    >
      <v-card
        class="py-1 pl-2 rounded-lg flex-shrink flex-grow-0 pr-2 z-5"
        outlined
        elevation="1"
      >
        <div class="flex items-center gap-2">
          <v-progress-circular
            v-if="state.groupState ==='connecting'"
            indeterminate
            :size="20"
            :width="3"
          />
          {{ tGroupState[state.groupState] }}
          <v-text-field
            v-model="groupId"
            class="max-w-40"
            hide-details
            dense
            outlined
            filled
            :label="t('multiplayer.groupId')"
            @click="onCopy(groupId)"
          />
          <v-btn
            :disabled="!state.group"
            text
            @click="onCopy(joinGroupUrl)"
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
            {{ copied ? t('multiplayer.copied') : t('multiplayer.inviteLink') }}
          </v-btn>

          <div class="text-gray-400 text-sm lg:block hidden">
            <template v-if="state.group">
              {{ t('multiplayer.copyGroupToFriendHint') }}
            </template>
            <template v-else>
              {{ t('multiplayer.joinOrCreateGroupHint') }}
            </template>
          </div>

          <div class="flex-grow" />
          <v-btn
            text
            :loading="joiningGroup"
            @click="onJoin()"
          >
            <template v-if="!state.group">
              <v-icon left>
                add
              </v-icon>
              {{ t('multiplayer.joinOrCreateGroup') }}
            </template>
            <template v-else>
              <v-icon
                color="red"
                left
              >
                delete
              </v-icon>
              {{ t('multiplayer.leaveGroup') }}
            </template>
          </v-btn>

          <v-tooltip
            bottom
            color="black"
          >
            <template #activator="{ on }">
              <v-btn
                text
                icon
                v-on="on"
                @click="showShareInstance()"
              >
                <v-icon>
                  share
                </v-icon>
              </v-btn>
            </template>
            {{ t('multiplayer.share') }}
          </v-tooltip>

          <v-menu
            left
            offset-y
          >
            <template #activator="{ on }">
              <v-tooltip
                left
                color="black"
              >
                <template #activator="{ on: onTooltip }">
                  <v-btn
                    text
                    icon
                    v-on="{ ...on, ...onTooltip }"
                  >
                    <v-icon>
                      build
                    </v-icon>
                  </v-btn>
                </template>
                {{ t('multiplayer.manualConnect') }}
              </v-tooltip>
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
      </v-card>

      <v-list
        two-line
        subheader
        class="py-2 flex flex-col gap-2 justify-start"
        style="width: 100%; background: transparent;"
      >
        <v-subheader class>
          {{ t("multiplayer.networkInfo") }}
        </v-subheader>

        <v-list-item
          v-if="device"
          class="flex-grow-0 flex-1"
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
            <v-list-item-subtitle class="flex gap-2 items-center">
              {{ device.friendlyName }}
            </v-list-item-subtitle>
          </v-list-item-content>
          <v-list-item-action
            class="self-center"
          >
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
          <v-list-item-action
            class="self-center"
          >
            <v-chip
              label
              outlined
            >
              <v-icon left>
                devices
              </v-icon>
              <a :href="device.modelURL">
                {{ device.modelName }}
              </a>
            </v-chip>
          </v-list-item-action>
        </v-list-item>

        <v-list-item
          class="flex-grow-0 flex-1"
        >
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
              <span v-if="natState.localIp">
                {{ natState.localIp }}
              </span>
              <span>
                {{ t('multiplayer.currentIpTitle') }}
              </span>
              <span class="font-bold">
                {{ natState.externalIp }}{{ natState.externalPort ? `:${natState.externalPort}` : '' }}
              </span>
            </v-list-item-subtitle>
          </v-list-item-content>
          <v-list-item-action class="flex flex-shrink flex-grow-0 flex-row self-center">
            <v-tooltip
              bottom
              transition="scroll-y-transition"
              color="black"
            >
              <template #activator="{on}">
                <span
                  class="font-bold"
                  :style="{color: natColors[natState.natType]}"
                  v-on="on"
                >
                  {{ natIcons[natState.natType] }}   {{ tNatType[natState.natType] }}
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
              :loading="isLoadingNetwork"
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
          class="h-full"
          :size="120"
          :text="t('multiplayer.placeholder')"
        />
        <v-list-item
          v-for="c of connections"
          :key="c.id"
          class="flex-grow-0 flex-1"
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
          <v-list-item-avatar>
            <PlayerAvatar
              :dimension="40"
              :src="c.userInfo.avatar"
            />
          </v-list-item-avatar>
          <v-list-item-content>
            <v-list-item-title>
              {{ c.userInfo.name || c.id }}
            </v-list-item-title>
            <v-list-item-subtitle class="flex gap-2 items-center">
              <v-chip
                label
                small
                :color="stateToColor[c.connectionState]"
              >
                <v-icon left>
                  signal_cellular_alt
                </v-icon>
                {{ t(`peerConnectionState.name`) }}:
                {{ tConnectionStates[c.connectionState] }}
                <template v-if="c.connectionState === 'connected'">
                  ({{ c.ping }}ms)
                </template>
              </v-chip>
              <!-- {{ c.ping }}ms -->
            </v-list-item-subtitle>
          </v-list-item-content>
          <v-list-item-action
            v-if="c.signalingState === 'have-local-offer'"
            class="self-center mr-5"
          >
            <v-list-item-subtitle>
              {{ t('peerSignalingState.have-local-offer') }}
            </v-list-item-subtitle>
          </v-list-item-action>
          <v-list-item-action
            v-if="c.iceGatheringState !== 'complete'"
            class="self-center mr-5"
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

          <v-list-item-action
            v-if="c.sharing"
            class="self-center"
          >
            <v-btn
              color="primary"
              outlined
              @click="showShareInstance(c.sharing)"
            >
              {{ t('multiplayer.sharing') }}
            </v-btn>
          </v-list-item-action>

          <v-list-item-action
            v-if="c.connectionState !== 'connected'"
            class="self-center"
          >
            <v-btn
              icon
              @click="edit(c.id, c.initiator)"
            >
              <v-icon>edit</v-icon>
            </v-btn>
          </v-list-item-action>
          <v-list-item-action class="self-center">
            <v-btn
              color="error"
              icon
              @click="startDelete(c.id)"
            >
              <v-icon>link_off</v-icon>
            </v-btn>
          </v-list-item-action>
        </v-list-item>
      </v-list>

      <MultiplayerDialogInitiate />
      <MultiplayerDialogReceive />
      <DeleteDialog
        :title="t('multiplayer.disconnected')"
        :persistent="false"
        :width="400"
        @confirm="doDelete"
      >
        {{ t('multiplayer.disconnectDescription', { user: deletingName, id: deleting }) }}
      </DeleteDialog>
    </v-layout>
  </v-container>
</template>
<script lang=ts setup>
import { BaseServiceKey, MappingInfo, NatServiceKey, PeerServiceKey, UserServiceKey } from '@xmcl/runtime-api'
import DeleteDialog from '../components/DeleteDialog.vue'
import { useDialog } from '../composables/dialog'
import MultiplayerDialogInitiate from './MultiplayerDialogInitiate.vue'
import MultiplayerDialogReceive from './MultiplayerDialogReceive.vue'
import { useBusy, useService, useServiceBusy } from '@/composables'
import PlayerAvatar from '../components/PlayerAvatar.vue'
import Hint from '@/components/Hint.vue'
import { useCurrentUser } from '@/composables/user'
import { useColorTheme } from '@/composables/colorTheme'

const { show } = useDialog('peer-initiate')
const { show: showShareInstance } = useDialog('share-instance')
const { show: showReceive } = useDialog('peer-receive')
const { show: showDelete } = useDialog('deletion')
const { state, joinGroup, leaveGroup, drop } = useService(PeerServiceKey)
const connections = computed(() => state.connections)
const { t } = useI18n()
const { handleUrl } = useService(BaseServiceKey)
const { gameProfile } = useCurrentUser()
const isLoadingNetwork = useServiceBusy(NatServiceKey, 'refreshNatType')

const { errorColor, successColor, warningColor } = useColorTheme()

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
const { state: natState, refreshNatType } = useService(NatServiceKey)
const device = computed(() => natState.natDevice)

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

const groupId = ref(state.group)
const modified = computed(() => groupId.value !== state.group)
const deleting = ref('')
const deletingName = computed(() => state.connections.find(c => c.id === deleting.value)?.userInfo.name)
const joinGroupUrl = computed(() => `https://xmcl.app/peer?group=${state.group}&inviter=${gameProfile.value.name}`)
const copied = ref(false)

const joiningGroup = useBusy('joinGroup')

watch(computed(() => state.group), (newVal) => {
  groupId.value = newVal
})

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

const startDelete = (id: string) => {
  deleting.value = id
  showDelete()
}
const startUnmap = (m: MappingInfo) => {

}
const edit = (id: string, init: boolean) => {
  const conn = state.connections.find(c => c.id === id)
  if (conn) {
    if (init) {
      show(id)
    } else {
      showReceive(id)
    }
  }
}

const doDelete = () => {
  console.log(`drop connection ${deleting.value}`)
  drop(deleting.value)
  deleting.value = ''
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
  if (!state.group) {
    joinGroup(groupId.value)
  } else {
    leaveGroup()
  }
}
const onCreate = () => {
  joinGroup()
}

</script>
