<template>
  <SettingCard :title="t('server.serversListTitle')" icon="dns">
    <SettingItemCheckbox
      :model-value="!!isServersListLinkedCache"
      :disabled="isServersListLinkedCache === undefined"
      :title="t('instance.useSharedServersList')"
      :description="t('instance.useSharedServersListDesc')"
      data-testid="use-shared-servers-list"
      @update:model-value="onToggleShared"
    />

    <v-divider />

    <div class="flex items-center gap-2 px-4 py-2">
      <span class="text-sm text-gray-400">
        {{ t('server.entryCount', { count: servers.length }) }}
      </span>
      <span v-if="hasPin" class="text-xs text-gray-500">
        · {{ t('server.pinnedHeader', { name: pinName }) }}
      </span>
      <div class="flex-grow" />
      <v-btn
        v-if="hasPin && !isServerUpstream"
        size="small"
        variant="text"
        color="primary"
        prepend-icon="cloud_sync"
        v-shared-tooltip="() => t('server.useAsUpstreamHint')"
        data-testid="bind-server-upstream"
        @click="bindAsUpstream"
      >
        {{ t('server.bindUpstream') }}
      </v-btn>
      <v-btn
        v-else-if="isServerUpstream"
        size="small"
        variant="text"
        color="warning"
        prepend-icon="cloud_off"
        v-shared-tooltip="() => t('server.boundUpstreamHint')"
        data-testid="unbind-server-upstream"
        @click="unbindUpstream"
      >
        {{ t('server.unbindUpstream') }}
      </v-btn>
      <v-btn
        v-if="servers.length > 0"
        icon
        size="small"
        variant="text"
        :loading="refreshing"
        v-shared-tooltip="() => t('shared.refresh')"
        :aria-label="t('shared.refresh')"
        data-testid="refresh-all-servers"
        @click="refreshAll"
      >
        <v-icon size="18">refresh</v-icon>
      </v-btn>
      <v-btn
        color="primary"
        variant="tonal"
        size="small"
        prepend-icon="add"
        data-testid="add-server-button"
        @click="onAdd"
      >
        {{ t('shared.add') }}
      </v-btn>
    </div>

    <div v-if="servers.length === 0" class="px-4 py-8 text-center text-gray-500 text-sm">
      {{ t('server.emptyHint') }}
    </div>

    <div v-else class="flex flex-col py-1">
      <BaseSettingServerItem
        v-for="(s, i) in servers"
        :key="`${s.ip}-${s.name}-${i}`"
        :server="s"
        :pinned="isRowPinned(s)"
        :refresh-token="refreshToken"
        @pin="togglePin(s)"
        @edit="onEdit(s)"
        @remove="onRemove(s, i)"
        @refreshed="onItemRefreshed"
      />
    </div>

    <div
      v-if="hasPin"
      class="px-4 pt-2 pb-4 flex items-center justify-between gap-2"
    >
      <span class="text-xs text-gray-500">{{ t('server.launchTargetHint') }}</span>
      <v-btn
        size="x-small"
        variant="text"
        color="grey"
        prepend-icon="rocket_launch"
        data-testid="launch-target-client"
        @click="unpin"
      >
        {{ t('server.launchClient') }}
      </v-btn>
    </div>
  </SettingCard>

  <v-dialog v-model="linkModel" width="440">
    <v-card>
      <v-card-item>
        <template #prepend>
          <v-avatar color="primary" variant="tonal">
            <v-icon>link</v-icon>
          </v-avatar>
        </template>
        <v-card-title class="text-base font-medium">
          {{ t('instance.linkFileTitle', { file: 'servers.dat' }) }}
        </v-card-title>
      </v-card-item>
      <v-card-text class="pt-0 text-sm opacity-80">
        {{ t('instance.linkFileDesc', { file: 'servers.dat' }) }}
      </v-card-text>
      <v-card-actions class="px-4 pb-4">
        <v-btn variant="text" @click="cancelLink">
          {{ t('shared.cancel') }}
        </v-btn>
        <v-spacer />
        <v-btn
          color="primary"
          variant="flat"
          rounded="pill"
          prepend-icon="link"
          @click="confirmLink"
        >
          {{ t('shared.yes') }}
        </v-btn>
      </v-card-actions>
    </v-card>
  </v-dialog>
</template>

<script lang="ts" setup>
import SettingCard from '@/components/SettingCard.vue'
import SettingItemCheckbox from '@/components/SettingItemCheckbox.vue'
import BaseSettingServerItem from './BaseSettingServerItem.vue'
import { useService } from '@/composables'
import { useDialog } from '@/composables/dialog'
import { useSimpleDialog } from '@/composables/dialog'
import { kInstance } from '@/composables/instance'
import { kInstanceServerInfo } from '@/composables/instanceServerInfo'
import { vSharedTooltip } from '@/directives/sharedTooltip'
import { injection } from '@/util/inject'
import { InstanceServerInfoServiceKey, InstanceServiceKey, ServerInfoWithStatus } from '@xmcl/runtime-api'
import useSWRV from 'swrv'

const { t } = useI18n()
const { instance } = injection(kInstance)
const { servers, removeServer } = injection(kInstanceServerInfo)
const { editInstance } = useService(InstanceServiceKey)
const { isLinked: isServersListLinked, link: linkServersList, unlink: unlinkServersList } = useService(InstanceServerInfoServiceKey)
const { show: showEditDialog } = useDialog('instance-server-edit')

const { path } = injection(kInstance)
const { data: isServersListLinkedCache, mutate: mutateServersLinked } = useSWRV(
  computed(() => `${path.value}/servers.dat/linked`),
  (key) => isServersListLinked(key.substring(0, key.indexOf('/servers.dat'))),
)
const { model: linkModel, show: showLinkConfirm, confirm: confirmLink, cancel: cancelLink } = useSimpleDialog<'servers.dat'>(
  () => {
    if (!instance.value) return
    linkServersList(instance.value.path).then(() => mutateServersLinked())
  },
)
function onToggleShared(next: boolean) {
  if (!instance.value) return
  if (next) {
    showLinkConfirm('servers.dat')
  } else {
    unlinkServersList(instance.value.path).then(() => mutateServersLinked())
  }
}

const hasPin = computed(() => !!instance.value?.server?.host)
const pinName = computed(() => instance.value?.server?.name || instance.value?.server?.host || '')
const isServerUpstream = computed(() => instance.value?.upstream?.type === 'server')

// Bulk "refresh all" (Minecraft-style single button). Bumping the token makes
// every row re-ping; each reports back via `refreshed` so we can clear the
// aggregate spinner once the last one settles.
const refreshToken = ref(0)
const pendingRefresh = ref(0)
const refreshing = computed(() => pendingRefresh.value > 0)
function refreshAll() {
  if (refreshing.value || servers.value.length === 0) return
  pendingRefresh.value = servers.value.length
  refreshToken.value++
}
function onItemRefreshed() {
  if (pendingRefresh.value > 0) pendingRefresh.value--
}

function isRowPinned(s: ServerInfoWithStatus) {
  const pin = instance.value?.server
  if (!pin) return false
  const parsed = parseIp(s.ip)
  if (parsed.host !== pin.host) return false
  if ((parsed.port ?? 25565) !== (pin.port ?? 25565)) return false
  if (pin.name !== undefined && s.name && pin.name !== s.name) return false
  return true
}

async function togglePin(s: ServerInfoWithStatus) {
  if (!instance.value) return
  if (isRowPinned(s)) {
    await editInstance({ instancePath: instance.value.path, server: null })
    return
  }
  const parsed = parseIp(s.ip)
  if (!parsed.host) return
  await editInstance({
    instancePath: instance.value.path,
    server: { host: parsed.host, port: parsed.port, name: s.name || undefined },
  })
}

async function unpin() {
  if (!instance.value) return
  await editInstance({ instancePath: instance.value.path, server: null })
}

function onAdd() {
  if (!instance.value) return
  showEditDialog({ instancePath: instance.value.path })
}

function onEdit(s: ServerInfoWithStatus) {
  if (!instance.value) return
  showEditDialog({
    instancePath: instance.value.path,
    server: { ip: s.ip, name: s.name, icon: s.icon, acceptTextures: s.acceptTextures as 0 | 1 },
  })
}

async function onRemove(s: ServerInfoWithStatus, index: number) {
  if (!instance.value) return
  const parsed = parseIp(s.ip)
  if (parsed.host && isRowPinned(s)) {
    await editInstance({ instancePath: instance.value.path, server: null })
  }
  await removeServer({
    instancePath: instance.value.path,
    host: parsed.host,
    port: parsed.port,
    name: s.name || undefined,
    // Always send the array index too. The runtime prefers it over the
    // (host, port, name) lookup, which is what lets us delete corrupt rows
    // that have an empty `ip`.
    index,
  })
}

async function bindAsUpstream() {
  if (!instance.value?.server) return
  const s = instance.value.server
  await editInstance({
    instancePath: instance.value.path,
    upstream: { type: 'server', host: s.host, port: s.port, name: s.name },
  })
}

async function unbindUpstream() {
  if (!instance.value) return
  await editInstance({ instancePath: instance.value.path, upstream: undefined })
}

function parseIp(ip: string): { host: string; port?: number } {
  if (!ip) return { host: '' }
  const v6 = /^\[([^\]]+)\](?::(\d+))?$/.exec(ip)
  if (v6) return { host: v6[1], port: v6[2] ? Number(v6[2]) : undefined }
  const idx = ip.lastIndexOf(':')
  if (idx >= 0 && /^\d+$/.test(ip.slice(idx + 1))) {
    return { host: ip.slice(0, idx), port: Number(ip.slice(idx + 1)) }
  }
  return { host: ip }
}
</script>
