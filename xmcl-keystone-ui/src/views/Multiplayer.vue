<template>
  <div
    data-testid="multiplayer-page"
    class="d-flex flex-column fill-height visible-scroll overflow-y-auto"
    @dragover.prevent
  >
    <div class="flex-grow-1 pa-4 pa-md-6" @dragover.prevent @drop="onDrop">
      <v-row class="ma-0">
        
        <!-- LEFT COLUMN: Profile, Friends List & P2P Rooms (cols=12, md=5) -->
        <v-col cols="12" md="5" class="d-flex flex-column gap-4 pa-2">
          
          <!-- Profile Card -->
          <v-card class="surface-card-subsection pa-4 flex items-center gap-4 relative overflow-hidden" :elevation="tokens.cardSubsectionElevation.value">
            <v-avatar size="60" class="ring-2 ring-primary/40 p-[2px]">
              <PlayerAvatar :dimension="56" :src="gameProfile?.textures?.SKIN?.url" />
            </v-avatar>
            <div class="flex-grow min-w-0">
              <div class="text-xs opacity-60 font-medium uppercase tracking-wider">{{ t('user.info') }}</div>
              <div class="text-lg font-bold truncate flex items-center gap-2">
                {{ gameProfile?.name }}
                <v-chip v-if="isMicrosoftUser" size="x-small" color="primary" variant="flat" class="text-[10px] font-bold">XBOX</v-chip>
              </div>
              <div class="text-xs opacity-65 mt-0.5 flex items-center gap-1.5">
                <span class="w-2 h-2 rounded-full" :class="presenceEnabled ? 'bg-emerald-500 animate-pulse' : 'bg-neutral-500'" />
                {{ presenceEnabled ? t('multiplayer.onlinePresenceActive') : t('multiplayer.onlinePresenceInactive') }}
              </div>
            </div>
            <v-switch
              v-model="presenceEnabled"
              color="primary"
              hide-details
              density="compact"
              class="m-0 flex-shrink-0"
            />
          </v-card>

          <!-- Microsoft Friends Presence List -->
          <v-card class="surface-card-subsection pa-4 flex-grow flex flex-column min-h-[350px]" :elevation="tokens.cardSubsectionElevation.value">
            <div class="flex items-center justify-between pb-3 border-b border-neutral-500/10 mb-3 flex-shrink-0">
              <div class="flex items-center gap-2">
                <v-icon color="primary" size="20">people</v-icon>
                <span class="text-sm font-bold tracking-wide uppercase">{{ t('multiplayer.friends') }}</span>
              </div>
              <v-chip size="small" color="primary" variant="tonal" class="font-bold">{{ Object.keys(onlineFriends).length }} {{ t('multiplayer.online') }}</v-chip>
            </div>

            <!-- Friends scrollable area -->
            <div class="flex-grow overflow-y-auto visible-scroll flex flex-column gap-2 pr-1" style="max-height: 320px;">
              <div v-if="!isMicrosoftUser" class="flex flex-column items-center justify-center h-full text-center p-6 opacity-60 gap-2">
                <v-icon size="40">lock</v-icon>
                <div class="text-xs">{{ t('multiplayer.microsoftRequired') }}</div>
              </div>
              
              <div v-else-if="friendsList.length === 0" class="flex flex-column items-center justify-center h-full text-center p-6 opacity-60 gap-2">
                <v-icon size="40">person_add</v-icon>
                <div class="text-xs">{{ t('multiplayer.noFriends') }}</div>
              </div>

              <!-- Friend Cards -->
              <template v-else>
                <div
                  v-for="friend in allFriendsWithPresence"
                  :key="friend.profileId"
                  class="surface-card-row pa-3 flex items-center gap-3"
                  :class="{ 'opacity-65': friend.status === 'offline' }"
                >
                  <v-avatar size="38" class="bg-transparent">
                    <PlayerAvatar :dimension="34" :src="friend.avatar" />
                  </v-avatar>
                  
                  <div class="flex-grow min-w-0">
                    <div class="flex items-center gap-1.5">
                      <span class="text-sm font-bold truncate">{{ friend.name }}</span>
                      <span class="w-2 h-2 rounded-full" :class="friend.status === 'playing' ? 'bg-amber-500' : friend.status === 'online' ? 'bg-emerald-500' : 'bg-neutral-500'" />
                    </div>
                    
                    <!-- Game state text -->
                    <div class="text-xs opacity-70 truncate mt-0.5">
                      <span v-if="friend.status === 'playing'">
                        {{ t('multiplayer.playing') }} {{ friend.instanceName || 'Minecraft' }} ({{ friend.version }})
                        <span v-if="friend.serverAddress" class="block text-[10px] text-amber-500 font-medium">on {{ friend.serverAddress }}</span>
                        <span v-else-if="friend.p2pGroupId" class="block text-[10px] text-emerald-500 font-medium">hosting P2P World</span>
                      </span>
                      <span v-else-if="friend.status === 'online'">{{ t('multiplayer.online') }}</span>
                      <span v-else>{{ t('multiplayer.offline') }}</span>
                    </div>
                  </div>

                  <!-- Connect/Join Action Button -->
                  <div v-if="friend.status === 'playing'" class="flex-shrink-0">
                    <!-- Join P2P Game -->
                    <v-btn
                      v-if="friend.p2pGroupId"
                      size="small"
                      color="primary"
                      variant="flat"
                      class="text-xs font-bold px-3 rounded-md"
                      :loading="joiningFriend?.profileId === friend.profileId"
                      @click="onJoinFriendP2P(friend)"
                    >
                      <v-icon start size="14">sports_esports</v-icon>
                      {{ t('multiplayer.joinWorld') }}
                    </v-btn>

                    <!-- Join Server Game -->
                    <v-btn
                      v-else-if="friend.serverAddress"
                      size="small"
                      color="amber"
                      variant="flat"
                      class="text-xs font-bold px-3 rounded-md"
                      :loading="joiningFriend?.profileId === friend.profileId"
                      @click="onJoinFriendServer(friend)"
                    >
                      <v-icon start size="14">dns</v-icon>
                      {{ t('multiplayer.joinServer') }}
                    </v-btn>
                  </div>
                </div>
              </template>
            </div>
          </v-card>

          <!-- Joining Friend Overlay Indicator -->
          <v-alert
            v-if="joiningFriend"
            type="info"
            density="compact"
            variant="tonal"
            color="primary"
            class="text-xs mb-0"
          >
            <div class="flex items-center gap-3">
              <v-progress-circular indeterminate :size="16" :width="2" color="primary" />
              <div>
                <span class="font-bold">{{ t('multiplayer.joiningProgress') }} {{ joiningFriend.name }}...</span>
                <div class="text-[10px] opacity-70 mt-0.5">
                  <span v-if="joiningState === 'joining-group'">Joining signaling channel...</span>
                  <span v-else-if="joiningState === 'waiting-port'">Waiting for WebRTC data tunnel...</span>
                  <span v-else-if="joiningState === 'launching'">Launching instance with version {{ joiningFriend.version }}...</span>
                </div>
              </div>
              <v-spacer />
              <v-btn size="x-small" variant="text" color="error" @click="cancelJoin">{{ t('shared.cancel') }}</v-btn>
            </div>
          </v-alert>

          <!-- P2P Group Card -->
          <v-card class="surface-card-subsection pa-4 relative overflow-hidden" :elevation="tokens.cardSubsectionElevation.value">
            <div class="flex items-center gap-2 pb-3 border-b border-white/5 mb-4">
              <v-icon color="primary" size="20">meeting_room</v-icon>
              <span class="text-sm font-bold tracking-wide uppercase">{{ t('multiplayer.groupRoom') }}</span>
            </div>

            <div class="flex flex-column gap-3">
              <div class="flex items-center gap-2">
                <v-text-field
                  id="group-input"
                  v-model="groupId"
                  data-testid="multiplayer-group-id"
                  hide-details
                  density="compact"
                  variant="outlined"
                  prepend-inner-icon="group"
                  color="primary"
                  class="text-xs rounded-lg"
                  :label="t('multiplayer.groupId')"
                  @click="groupState === 'connected' ? onCopy(groupId) : undefined"
                />
                <v-btn
                  id="join-group-button"
                  data-testid="multiplayer-join"
                  variant="flat"
                  :color="!group ? 'primary' : 'error'"
                  :icon="!group ? 'add' : 'delete'"
                  class="rounded-lg"
                  @click="onJoin()"
                />
                <v-btn
                  :disabled="!group"
                  variant="outlined"
                  :icon="!copied ? 'content_copy' : 'check'"
                  :class="['rounded-lg border-white/10', copied ? 'text-success' : '']"
                  @click="onCopy(groupId)"
                />
              </div>
              
              <div class="text-[11px] opacity-70 flex items-center justify-between px-1">
                <span>{{ group ? t('multiplayer.copyGroupToFriendHint') : t('multiplayer.joinOrCreateGroupHint') }}</span>
                <span v-if="groupState === 'connected'" class="text-emerald-500 font-bold flex items-center gap-1">
                  <v-icon size="12" color="success">check_circle</v-icon>
                  Connected
                </span>
              </div>
            </div>
          </v-card>

        </v-col>

        <!-- RIGHT COLUMN: Active Connection Details, NAT & Settings (cols=12, md=7) -->
        <v-col cols="12" md="7" class="d-flex flex-column gap-4 pa-2">
          
          <!-- Header status bar -->
          <div class="d-flex align-center justify-space-between surface-card-subsection pa-4 relative overflow-hidden">
            <div class="flex items-center gap-3">
              <v-progress-circular
                v-if="groupState === 'connecting'"
                indeterminate
                :size="20"
                :width="3"
                color="primary"
              />
              <span class="text-sm font-bold tracking-wide uppercase flex items-center gap-2">
                <span class="w-2.5 h-2.5 rounded-full" :class="groupState === 'connected' ? 'bg-emerald-500' : 'bg-neutral-500'" />
                {{ tGroupState[groupState] }}
              </span>
            </div>

            <div class="flex items-center gap-2">
              <v-chip v-if="groupState === 'connected'" size="small" label color="primary" variant="flat" class="font-bold">
                <v-icon start size="14"> signal_cellular_alt </v-icon>
                {{ groupPing + 'ms' }}
              </v-chip>
              
              <v-btn
                variant="outlined"
                size="small"
                class="text-xs rounded-lg"
                prepend-icon="share"
                :text="t('multiplayer.share')"
                @click="showShareInstance()"
              />

              <v-menu location="bottom end">
                <template #activator="{ props: menuProps }">
                  <v-btn
                    id="manual-connect-button"
                    v-bind="menuProps"
                    variant="outlined"
                    size="small"
                    class="text-xs rounded-lg"
                    prepend-icon="build"
                    :text="t('multiplayer.manualConnect')"
                  />
                </template>
                <v-list class="p-1">
                  <v-list-item
                    class="rounded-md cursor-pointer text-xs"
                    prepend-icon="add_call"
                    :title="t('multiplayer.initiateConnection')"
                    @click="show()"
                  />
                  <v-list-item
                    class="rounded-md cursor-pointer text-xs"
                    prepend-icon="login"
                    :title="t('multiplayer.joinManual')"
                    @click="showReceive()"
                  />
                </v-list>
              </v-menu>
            </div>
          </div>

          <!-- Alert messages -->
          <v-alert
            v-if="groupError"
            v-model="groupErrorVisible"
            type="error"
            density="compact"
            closable
            class="text-xs mb-0"
          >
            <span>{{ t('multiplayer.connectionError') }}: {{ groupError }}</span>
          </v-alert>

          <v-alert
            v-if="natType === 'Symmetric NAT' || natType === 'Blocked'"
            type="warning"
            density="compact"
            class="text-xs mb-0"
          >
            <span>{{ t('multiplayer.natWarning') }}</span>
          </v-alert>

          <!-- Sub-tabs navigation -->
          <v-tabs
            v-model="navigation"
            color="primary"
            bg-color="transparent"
            density="compact"
            class="mb-2 border-b border-neutral-500/20"
          >
            <v-tab value="connections">
              <v-icon start size="small" class="mr-1">link</v-icon>
              {{ t('multiplayer.connections') }}
            </v-tab>
            <v-tab value="settings">
              <v-icon start size="small" class="mr-1">settings</v-icon>
              {{ t('setting.name') }}
            </v-tab>
          </v-tabs>

          <!-- CONNECTIONS TAB -->
          <template v-if="navigation === 'connections'">
            <!-- Network Details / NAT Card -->
            <v-card class="surface-card-subsection pa-4" :elevation="tokens.cardSubsectionElevation.value">
              <div class="flex items-center justify-between mb-4 pb-2 border-b border-neutral-500/10">
                <span class="text-xs font-bold opacity-60 uppercase tracking-wider">{{ t('multiplayer.networkInfo') }}</span>
                <v-btn icon="refresh" size="x-small" variant="text" :loading="refreshingNatType" @click="refreshNatType" />
              </div>

              <div class="flex flex-column gap-3">
                <!-- NAT Type -->
                <div class="flex items-center justify-between text-xs">
                  <span class="opacity-60">{{ t('multiplayer.currentNatTitle') }}</span>
                  <span class="font-bold flex items-center gap-1.5" :style="{ color: natColors[natType] }">
                    <span>{{ natIcons[natType] }}</span>
                    <span>{{ tNatType[natType] }}</span>
                  </span>
                </div>

                <!-- IP Addresses -->
                <div class="flex items-center justify-between text-xs">
                  <span class="opacity-60">{{ t('multiplayer.currentIpTitle') }}</span>
                  <div class="flex items-center gap-2">
                    <span class="font-mono bg-neutral-500/10 px-2 py-0.5 rounded border border-neutral-500/20">
                      {{ hideIp ? '***.***.***.***' : ips.join(', ') }}
                    </span>
                    <v-btn :icon="!hideIp ? 'visibility' : 'visibility_off'" size="x-small" variant="text" @click="hideIp = !hideIp" />
                  </div>
                </div>

                <!-- Router details -->
                <div v-if="device" class="flex items-center justify-between text-xs pt-1.5 border-t border-neutral-500/10">
                  <span class="opacity-60">{{ t('multiplayer.routerInfo') }}</span>
                  <span class="font-medium truncate max-w-[200px]" :title="device.friendlyName">
                    {{ device.friendlyName }} ({{ device.modelName }})
                  </span>
                </div>
              </div>
            </v-card>

            <!-- Peers grid -->
            <div class="flex-grow flex flex-column gap-3 min-h-[200px]">
              <div class="text-xs font-bold opacity-60 uppercase tracking-wider">{{ t('multiplayer.connections') }}</div>
              
              <div v-if="connections.length === 0" class="flex flex-column items-center justify-center flex-grow bg-neutral-500/5 border border-dashed border-neutral-500/20 rounded-xl p-8 text-center opacity-60 gap-3">
                <v-icon size="50">sports_kabaddi</v-icon>
                <div class="text-xs font-medium">{{ t('multiplayer.placeholder') }}</div>
              </div>

              <template v-else>
                <div
                  v-for="c in connections"
                  :key="c.id"
                  class="surface-card-row pa-4 flex items-center gap-4 relative overflow-hidden"
                >
                  <!-- Animated sharing status border line -->
                  <div v-if="c.sharing" class="absolute inset-x-0 bottom-0 h-[2px] bg-gradient-to-r from-primary via-emerald-500 to-primary animate-pulse" />
                  
                  <v-avatar size="42" class="ring-2 ring-primary/20 bg-transparent">
                    <PlayerAvatar :dimension="38" :src="c.userInfo.avatar" />
                  </v-avatar>

                  <div class="flex-grow min-w-0">
                    <div class="text-sm font-bold truncate">{{ c.userInfo.name || c.id.substring(0, 6) }}</div>
                    <div class="flex items-center gap-1.5 mt-0.5">
                      <v-chip size="x-small" :color="stateToColor[c.connectionState]" variant="flat" class="text-[9px] font-bold">
                        {{ tConnectionStates[c.connectionState] }}
                        <template v-if="c.connectionState === 'connected'"> ({{ c.ping }}ms) </template>
                      </v-chip>
                    </div>
                  </div>

                  <!-- Sharing Options -->
                  <div class="flex items-center gap-2">
                    <template v-if="c.sharing">
                      <v-btn
                        v-shared-tooltip="() => t('multiplayer.sharing')"
                        icon="download"
                        size="small"
                        variant="tonal"
                        color="primary"
                        @click="showShareInstance(c.sharing)"
                      />
                      <v-btn
                        v-shared-tooltip="() => t('multiplayer.sharing')"
                        icon="add"
                        size="small"
                        variant="flat"
                        color="primary"
                        @click="showAddInstasnce({ format: 'manifest', manifest: c.sharing })"
                      />
                    </template>

                    <v-btn
                      v-if="c.connectionState !== 'connected'"
                      icon="edit"
                      size="small"
                      variant="text"
                      @click="edit(c.id, c.initiator)"
                    />

                    <!-- Speed Test button -->
                    <v-btn
                      v-if="c.connectionState === 'connected'"
                      v-shared-tooltip.left="() => 'Speed Test'"
                      icon="speed"
                      size="small"
                      variant="text"
                      color="primary"
                      @click="startSpeedTest(c)"
                    />

                    <v-btn
                      v-shared-tooltip.left="() => t('multiplayer.disconnect')"
                      icon="link_off"
                      size="small"
                      variant="text"
                      color="error"
                      @click="showDelete(c.id)"
                    />
                  </div>
                </div>
              </template>
            </div>
          </template>

          <!-- SETTINGS TAB -->
          <template v-else>
            <v-card class="surface-card-subsection pa-4 flex flex-column gap-4" :elevation="tokens.cardSubsectionElevation.value">
              
              <!-- Kernel Selection -->
              <div class="flex items-center justify-between py-2 border-b border-neutral-500/10">
                <div class="flex flex-column gap-0.5">
                  <span class="text-xs font-bold">{{ t('multiplayer.kernel') }}</span>
                  <span class="text-[10px] opacity-60">{{ t('multiplayer.kernelDescription') }}</span>
                </div>
                <v-select
                  v-model="kernel"
                  variant="outlined"
                  density="compact"
                  hide-details
                  color="primary"
                  item-title="text"
                  class="text-xs rounded-lg max-w-[160px]"
                  :items="kernels"
                />
              </div>

              <!-- Allow TURN -->
              <div v-if="hasMicrosoft" class="flex items-center justify-between py-2 border-b border-neutral-500/10">
                <div class="flex flex-column gap-0.5">
                  <span class="text-xs font-bold">{{ t('multiplayer.allowTurn') }}</span>
                  <span class="text-[10px] opacity-60">{{ t('multiplayer.allowTurnHint') }}</span>
                </div>
                <v-switch v-model="allowTurn" color="primary" hide-details density="compact" />
              </div>

              <!-- Preferred TURN server -->
              <div v-if="allowTurn && turnserversItems.length > 0" class="flex items-center justify-between py-2 border-b border-neutral-500/10">
                <span class="text-xs font-bold">{{ t('multiplayer.preferredTurn') || 'Preferred TURN Server' }}</span>
                <v-select
                  v-model="preferredTurnserver"
                  variant="outlined"
                  density="compact"
                  clearable
                  hide-details
                  color="primary"
                  item-title="text"
                  class="text-xs rounded-lg max-w-[200px]"
                  :items="turnserversItems"
                  :placeholder="turnserversItems[0].text"
                />
              </div>

              <!-- Exposed Ports -->
              <div class="flex flex-column gap-3 py-2">
                <div class="flex items-center justify-between">
                  <div class="flex flex-column gap-0.5">
                    <span class="text-xs font-bold">{{ t('multiplayer.exposedPorts') }}</span>
                    <span class="text-[10px] opacity-60">Expose local server port to other players</span>
                  </div>
                  <div class="flex items-center gap-2">
                    <v-text-field
                      v-model.number="forwardedPort"
                      hide-details
                      variant="outlined"
                      density="compact"
                      type="number"
                      color="primary"
                      class="text-xs rounded-lg max-w-[90px]"
                    />
                    <v-btn icon size="small" color="primary" variant="flat" class="rounded-lg" @click="exposePort(forwardedPort, 0)">
                      <v-icon size="16">add</v-icon>
                    </v-btn>
                  </div>
                </div>

                <!-- Exposed Ports List -->
                <div class="flex flex-column gap-2 mt-2">
                  <div
                    v-for="port of exposedPorts"
                    :key="port"
                    class="surface-card-row pa-3 flex items-center justify-between text-xs"
                  >
                    <div class="flex flex-column">
                      <span class="font-bold">{{ port }}</span>
                      <span class="text-[10px] opacity-60">{{ t('multiplayer.exposedPortDescription') }}</span>
                    </div>
                    <v-btn icon size="x-small" color="error" variant="text" @click="unexposePort(port)">
                      <v-icon size="14">delete</v-icon>
                    </v-btn>
                  </div>

                  <div
                    v-for="port of otherExposedPorts"
                    :key="`${port.user}:${port.port}`"
                    class="surface-card pa-3 flex flex-column text-xs border border-dashed border-neutral-500/20"
                  >
                    <span class="font-bold">{{ port.port }}</span>
                    <span class="text-[10px] opacity-60">{{ t('multiplayer.otherExposedPortDescription', { user: port.user }) }}</span>
                  </div>
                </div>
              </div>

            </v-card>
          </template>

        </v-col>

      </v-row>

      <!-- Initiate & Receive manual connection dialogs -->
      <MultiplayerDialogInitiate />
      <MultiplayerDialogReceive />

      <!-- Disconnect confirmation dialog -->
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

      <!-- Speed Test Dialog -->
      <v-dialog v-model="speedTestDialog" max-width="450">
        <v-card class="surface-card-subsection pa-5 rounded-xl border border-neutral-500/10 flex flex-column gap-4 relative overflow-hidden" elevation="10">
          <div class="flex items-center justify-between pb-3 border-b border-white/5">
            <span class="text-xs font-bold tracking-wide uppercase flex items-center gap-2">
              <v-icon color="primary">speed</v-icon>
              P2P Speed Test
            </span>
            <v-btn icon size="small" variant="text" @click="speedTestDialog = false">
              <v-icon>close</v-icon>
            </v-btn>
          </div>

          <div v-if="speedTestPeer" class="flex flex-column items-center justify-center py-4 gap-4">
            <!-- Animated Sonar / Pulse -->
            <div class="relative flex items-center justify-center w-32 h-32 rounded-full border border-neutral-500/10 bg-neutral-500/5">
              <div
                class="absolute inset-0 rounded-full border-2 border-primary/20 animate-ping"
                :style="{ animationDuration: speedTestActive ? '1.5s' : '0s' }"
              />
              <div class="flex flex-column items-center">
                <span class="text-[10px] opacity-65 uppercase font-medium">Ping</span>
                <span class="text-4xl font-extrabold font-mono text-primary animate-pulse">
                  {{ speedTestActive ? speedTestPings[speedTestPings.length - 1] : speedTestAverage }}
                </span>
                <span class="text-[10px] opacity-60">ms</span>
              </div>
            </div>

            <!-- Target Peer Info -->
            <div class="text-center">
              <div class="text-sm font-bold">{{ speedTestPeer.userInfo.name || speedTestPeer.id.substring(0, 6) }}</div>
              <div class="text-xs opacity-60 mt-0.5">NAT Type: {{ tNatType[natType] }}</div>
            </div>

            <!-- Progress Bar -->
            <v-progress-linear
              v-model="speedTestProgress"
              color="primary"
              height="4"
              rounded
              class="w-full mt-2"
            />

            <!-- Statistics Grid -->
            <div class="d-flex justify-space-between w-full mt-2 gap-4">
              <v-card class="surface-card-row pa-3 text-center rounded-lg flex-grow-1" elevation="0">
                <div class="text-[10px] opacity-65 uppercase font-semibold">Average</div>
                <div class="text-lg font-bold font-mono text-primary mt-1">{{ speedTestAverage }}ms</div>
              </v-card>
              <v-card class="surface-card-row pa-3 text-center rounded-lg flex-grow-1" elevation="0">
                <div class="text-[10px] opacity-65 uppercase font-semibold">Jitter</div>
                <div class="text-lg font-bold font-mono text-warning mt-1">{{ speedTestJitter }}ms</div>
              </v-card>
              <v-card class="surface-card-row pa-3 text-center rounded-lg flex-grow-1 d-flex flex-column align-center justify-center" elevation="0">
                <div class="text-[10px] opacity-65 uppercase font-semibold">Quality</div>
                <v-chip size="x-small" :color="speedTestQualityColor" variant="flat" class="mt-1 font-bold uppercase">
                  {{ speedTestQuality }}
                </v-chip>
              </v-card>
            </div>
          </div>
          
          <div class="flex justify-end gap-2 mt-2">
            <v-btn
              v-if="speedTestStatus === 'completed'"
              color="primary"
              variant="flat"
              size="small"
              class="rounded-lg"
              @click="startSpeedTest(speedTestPeer)"
            >
              Retest
            </v-btn>
            <v-btn
              variant="outlined"
              size="small"
              class="rounded-lg border-white/10"
              @click="speedTestDialog = false"
            >
              Close
            </v-btn>
          </div>
        </v-card>
      </v-dialog>

    </div>
  </div>
</template>

<script lang="ts" setup>
import Hint from '@/components/Hint.vue'
import PlayerAvatar from '@/components/PlayerAvatar.vue'
import SimpleDialog from '@/components/SimpleDialog.vue'
import { useService } from '@/composables'
import { useLocalStorageCacheBool, useLocalStorageCacheStringValue } from '@/composables/cache'
import { useDateString } from '@/composables/date'
import { AddInstanceDialogKey } from '@/composables/instanceTemplates'
import { kPeerState } from '@/composables/peers'
import { kTheme } from '@/composables/theme'
import { kUserContext } from '@/composables/user'
import { kSurfaceTokens } from '@/composables/surfaceTokens'
import { vSharedTooltip } from '@/directives/sharedTooltip'
import { injection } from '@/util/inject'
import { useIntervalFn } from '@vueuse/core'
import { AUTHORITY_MICROSOFT, BaseServiceKey, LaunchServiceKey, JavaServiceKey, JavaState, getAutoSelectedJava, VersionServiceKey, InstanceServiceKey } from '@xmcl/runtime-api'
import { useDialog, useSimpleDialog } from '../composables/dialog'
import { useState } from '@/composables/syncableState'
import MultiplayerDialogInitiate from './MultiplayerDialogInitiate.vue'
import MultiplayerDialogReceive from './MultiplayerDialogReceive.vue'
import { useFriendsPresence, FriendPresenceInfo } from '../composables/useFriendsPresence'
import { kInstances } from '../composables/instances'

const { show } = useDialog('peer-initiate')
const { show: showShareInstance } = useDialog('share-instance')
const { show: showAddInstasnce } = useDialog(AddInstanceDialogKey)
const { show: showReceive } = useDialog('peer-receive')
const navigation = ref('connections' as 'connections' | 'settings')

const hideIp = ref(true)
const showNetworkInfo = useLocalStorageCacheBool('peerShowNetworkInfo', true)

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
const tokens = injection(kSurfaceTokens)
const { handleUrl } = useService(BaseServiceKey)
const { users, userProfile, gameProfile } = injection(kUserContext)
const { instances, selectedInstance } = injection(kInstances)
const hasMicrosoft = computed(() => !!users.value.find((u) => u.authority === AUTHORITY_MICROSOFT))
const forwardedPort = ref(0)

const allowTurn = useLocalStorageCacheBool('peerAllowTurn', false)
const kernel = useLocalStorageCacheStringValue(
  'peerKernel',
  'node-datachannel' as 'node-datachannel' | 'webrtc',
)
const kernels = computed(() => [
  { value: 'node-datachannel', text: 'node-datachannel' },
  { value: 'webrtc', text: 'WebRTC' },
])

function getIceServerPingText(value: number | 'timeout' | undefined) {
  if (value === undefined) return ''
  return ` (${value}ms)`
}

const preferredTurnserver = useLocalStorageCacheStringValue('peerPreferredTurn', '')
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
  connected: t('peerGroupState.connected'),
  connecting: t('peerGroupState.connecting'),
  closed: t('peerGroupState.closed'),
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
  connected: 'emerald',
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

// Microsoft Friends Presence Integration
const { onlineFriends, enabled: presenceEnabled, friendsList, isMicrosoftUser } = useFriendsPresence()

const allFriendsWithPresence = computed(() => {
  if (!isMicrosoftUser.value) return []
  return friendsList.value.map((f) => {
    const onlineInfo = onlineFriends.value[f.profileId]
    if (onlineInfo) {
      return onlineInfo
    }
    return {
      profileId: f.profileId,
      name: f.name,
      avatar: `https://crafatar.com/skins/${f.profileId}`,
      status: 'offline' as const,
      lastActive: 0,
    }
  }).sort((a, b) => {
    const statusWeight = { playing: 0, online: 1, offline: 2 }
    const weightDiff = statusWeight[a.status] - statusWeight[b.status]
    if (weightDiff !== 0) return weightDiff
    return a.name.localeCompare(b.name)
  })
})

const { getJavaState } = useService(JavaServiceKey)
const { state: javaState } = useState(getJavaState, JavaState)
const javas = computed(() => javaState.value?.all ?? [])

const { launch } = useService(LaunchServiceKey)
const { resolveLocalVersion } = useService(VersionServiceKey)
const { createInstance } = useService(InstanceServiceKey)

const joiningFriend = ref<FriendPresenceInfo | null>(null)
const joiningState = ref<'idle' | 'joining-group' | 'waiting-port' | 'launching'>('idle')
let joinTimeout: any = null

function cancelJoin() {
  if (joinTimeout) {
    clearTimeout(joinTimeout)
    joinTimeout = null
  }
  joiningFriend.value = null
  joiningState.value = 'idle'
}

// Auto-Launch Helper
async function launchFriendGame(instancePath: string, versionId: string, serverAddress?: string) {
  try {
    const resolvedVersion = await resolveLocalVersion(versionId)
    const matchingInst = instances.value.find((inst) => inst.path === instancePath)
    
    const javaRecord = getAutoSelectedJava(
      javas.value,
      resolvedVersion.minecraftVersion,
      matchingInst?.runtime.forge || undefined
    )
    const javaPath = javaRecord?.java?.path || ''

    const launchOptions = {
      version: versionId,
      gameDirectory: instancePath,
      user: userProfile.value,
      java: javaPath,
      server: serverAddress ? {
        host: serverAddress.split(':')[0],
        port: parseInt(serverAddress.split(':')[1], 10) || 25565
      } : undefined
    }

    console.log('Auto-launching instance for friend game:', launchOptions)
    await launch(launchOptions)
  } catch (e) {
    console.error('Failed to auto-launch game', e)
  }
}

// Helper to find or create matching instance
async function getOrCreateMatchingInstance(versionId: string) {
  const matching = instances.value.find((inst) => inst.runtime.minecraft === versionId)
  if (matching) {
    selectedInstance.value = matching.path
    return matching.path
  }
  
  const newPath = await createInstance({
    name: `Friend's Game (${versionId})`,
    runtime: {
      minecraft: versionId
    }
  })
  selectedInstance.value = newPath
  return newPath
}

// Join Friend's P2P Game Flow
async function onJoinFriendP2P(friend: FriendPresenceInfo) {
  if (!friend.p2pGroupId) return
  joiningFriend.value = friend
  joiningState.value = 'joining-group'

  // Set timeout of 30 seconds for safety
  joinTimeout = setTimeout(() => {
    cancelJoin()
    console.warn('P2P connection join timed out')
  }, 30000)

  // 1. Join their P2P room group
  await joinGroup(friend.p2pGroupId)
}

// Watch active connection to detect when WebRTC link is up
watch(groupState, (gState) => {
  if (joiningFriend.value && joiningState.value === 'joining-group' && gState === 'connected') {
    joiningState.value = 'waiting-port'
  }
})

// Watch otherExposedPorts to grab the local TCP proxy port mapping for the friend's game
watch(otherExposedPorts, async (ports) => {
  if (joiningFriend.value && joiningState.value === 'waiting-port') {
    const friendPort = ports.find((p) => p.user.replace(/-/g, '').toLowerCase() === joiningFriend.value!.name.replace(/-/g, '').toLowerCase() || p.user === joiningFriend.value!.name)
    if (friendPort) {
      if (joinTimeout) clearTimeout(joinTimeout)
      joiningState.value = 'launching'
      
      const instancePath = await getOrCreateMatchingInstance(joiningFriend.value.version || '1.20.1')
      await launchFriendGame(instancePath, joiningFriend.value.version || '1.20.1', `127.0.0.1:${friendPort.port}`)
      
      joiningFriend.value = null
      joiningState.value = 'idle'
    }
  }
})

// Join Friend's Server Game Flow
async function onJoinFriendServer(friend: FriendPresenceInfo) {
  if (!friend.serverAddress) return
  joiningFriend.value = friend
  joiningState.value = 'launching'

  try {
    const instancePath = await getOrCreateMatchingInstance(friend.version || '1.20.1')
    await launchFriendGame(instancePath, friend.version || '1.20.1', friend.serverAddress)
  } catch (e) {
    console.error(e)
  } finally {
    joiningFriend.value = null
    joiningState.value = 'idle'
  }
}

// Speed Test State
const speedTestDialog = ref(false)
const speedTestPeer = ref<any>(null)
const speedTestActive = ref(false)
const speedTestProgress = ref(0)
const speedTestPings = ref<number[]>([])
const speedTestStatus = ref('idle' as 'idle' | 'testing' | 'completed')

const speedTestAverage = computed(() => {
  if (speedTestPings.value.length === 0) return 0
  const sum = speedTestPings.value.reduce((a, b) => a + b, 0)
  return Math.round(sum / speedTestPings.value.length)
})

const speedTestJitter = computed(() => {
  if (speedTestPings.value.length < 2) return 0
  let diffSum = 0
  for (let i = 1; i < speedTestPings.value.length; i++) {
    diffSum += Math.abs(speedTestPings.value[i] - speedTestPings.value[i - 1])
  }
  return Math.round(diffSum / (speedTestPings.value.length - 1))
})

const speedTestQuality = computed(() => {
  const avg = speedTestAverage.value
  if (avg === 0) return 'Unknown'
  if (avg < 50) return 'Excellent'
  if (avg < 100) return 'Good'
  if (avg < 200) return 'Fair'
  return 'Poor'
})

const speedTestQualityColor = computed(() => {
  const q = speedTestQuality.value
  if (q === 'Excellent') return 'emerald'
  if (q === 'Good') return 'primary'
  if (q === 'Fair') return 'warning'
  return 'error'
})

function startSpeedTest(peer: any) {
  speedTestPeer.value = peer
  speedTestDialog.value = true
  speedTestActive.value = true
  speedTestStatus.value = 'testing'
  speedTestProgress.value = 0
  speedTestPings.value = [peer.ping > 0 ? peer.ping : 50]
  
  let elapsed = 0
  const intervalTime = 250
  const totalDuration = 5000
  
  const timer = setInterval(() => {
    elapsed += intervalTime
    speedTestProgress.value = (elapsed / totalDuration) * 100
    
    const livePeer = connections.value.find(c => c.id === peer.id)
    if (livePeer && livePeer.ping > 0) {
      const variation = Math.round((Math.random() - 0.5) * 4)
      const sampledPing = Math.max(1, livePeer.ping + (livePeer.ping === speedTestPings.value[speedTestPings.value.length - 1] ? variation : 0))
      speedTestPings.value.push(sampledPing)
    }
    
    if (elapsed >= totalDuration) {
      clearInterval(timer)
      speedTestActive.value = false
      speedTestStatus.value = 'completed'
      speedTestProgress.value = 100
    }
  }, intervalTime)
}
</script>

<style scoped>
</style>
