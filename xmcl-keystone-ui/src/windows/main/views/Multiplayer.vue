<template>
  <v-container
    fluid
    style="z-index: 2; overflow: auto"
    class="overflow-auto h-full"
    @dragover.prevent
  >
    <v-layout
      class="overflow-auto h-full flex-col"
      @dragover.prevent
      @drop="onDrop"
    >
      <v-card
        class="flex py-1 rounded-lg flex-shrink flex-grow-0 items-center pr-2 gap-2 z-5"
        outlined
        elevation="1"
      >
        <div class="flex-grow" />
        <v-btn
          text
          @click="showShareInstance()"
        >
          <v-icon left>
            share
          </v-icon>
          {{ t('multiplayer.share') }}
        </v-btn>

        <v-btn
          text
          @click="show()"
        >
          <v-icon left>
            add_call
          </v-icon>
          {{ t('multiplayer.initiateConnection') }}
        </v-btn>

        <v-btn
          text
          @click="showReceive()"
        >
          <v-icon left>
            login
          </v-icon>
          {{ t('multiplayer.joinManual') }}
        </v-btn>
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
        style="width: 100%; background: transparent;"
      >
        <v-list-item
          v-for="c of connections"
          :key="c.id"
        >
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
            <v-list-item-subtitle class="flex gap-2 ">
              <v-chip
                label
                small
                :color="stateToColor[c.connectionState]"
              >
                <v-icon left>
                  signal_cellular_alt
                </v-icon>
                {{ t(`peerConnectionState.name`) }}:
                {{ t(`peerConnectionState.${c.connectionState}`) }}
              </v-chip>
              <!-- <v-chip
                label
                small
              >
                {{ c.signalingState }}
              </v-chip> -->
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
import { BaseServiceKey, PeerServiceKey } from '@xmcl/runtime-api'
import DeleteDialog from '../components/DeleteDialog.vue'
import { useDialog } from '../composables/dialog'
import MultiplayerDialogInitiate from './MultiplayerDialogInitiate.vue'
import MultiplayerDialogReceive from './MultiplayerDialogReceive.vue'
import { useI18n, useService } from '/@/composables'
import PlayerAvatar from '../components/PlayerAvatar.vue'
import Hint from '/@/components/Hint.vue'

const { show } = useDialog('peer-initiate')
const { show: showShareInstance } = useDialog('share-instance')
const { show: showReceive } = useDialog('peer-receive')
const { show: showDelete } = useDialog('deletion')
const service = useService(PeerServiceKey)
const connections = computed(() => service.state.connections)
const { t } = useI18n()

const deleting = ref('')
const deletingName = computed(() => service.state.connections.find(c => c.id === deleting.value)?.userInfo.name)

const stateToColor: Record<string, string> = {
  failed: 'error',
  disconnected: 'error',
  connected: 'primary',
  closed: 'secondary',
}

const startDelete = (id: string) => {
  deleting.value = id
  showDelete()
}
const edit = (id: string, init: boolean) => {
  const conn = service.state.connections.find(c => c.id === id)
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
  service.drop(deleting.value)
  deleting.value = ''
}

const { handleUrl } = useService(BaseServiceKey)
const onDrop = (e: DragEvent) => {
  const url = e.dataTransfer?.getData('xmcl/url')
  if (url) {
    handleUrl(url)
  }
}

</script>
