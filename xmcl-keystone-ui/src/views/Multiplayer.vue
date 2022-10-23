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
        class="flex py-1 pl-2 rounded-lg flex-shrink flex-grow-0 items-center pr-2 gap-2 z-5"
        outlined
        elevation="1"
      >
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

        <div class="text-gray-400 text-sm">
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
              Connect Manually
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
      </v-card>

      <Hint
        v-if="connections.length === 0"
        icon="sports_kabaddi"
        class="h-full"
        :size="120"
        :text="t('multiplayer.placeholder')"
      />
      <v-list
        two-line
        subheader
        class="py-2 flex flex-col gap-2 justify-start"
        style="width: 100%; background: transparent;"
      >
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
import { BaseServiceKey, PeerServiceKey, UserServiceKey } from '@xmcl/runtime-api'
import DeleteDialog from '../components/DeleteDialog.vue'
import { useDialog } from '../composables/dialog'
import MultiplayerDialogInitiate from './MultiplayerDialogInitiate.vue'
import MultiplayerDialogReceive from './MultiplayerDialogReceive.vue'
import { useService } from '@/composables'
import PlayerAvatar from '../components/PlayerAvatar.vue'
import Hint from '@/components/Hint.vue'
import { useCurrentUser } from '@/composables/user'

const { show } = useDialog('peer-initiate')
const { show: showShareInstance } = useDialog('share-instance')
const { show: showReceive } = useDialog('peer-receive')
const { show: showDelete } = useDialog('deletion')
const { state, joinGroup, leaveGroup, drop } = useService(PeerServiceKey)
const connections = computed(() => state.connections)
const { t } = useI18n()
const { handleUrl } = useService(BaseServiceKey)
const { gameProfile } = useCurrentUser()

const groupId = ref(state.group)
const modified = computed(() => groupId.value !== state.group)
const deleting = ref('')
const deletingName = computed(() => state.connections.find(c => c.id === deleting.value)?.userInfo.name)
const joinGroupUrl = computed(() => `https://xmcl.app/peer?group=${state.group}&inviter=${gameProfile.value.name}`)
const copied = ref(false)

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
