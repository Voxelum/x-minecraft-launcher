<template>
  <div
    class="server-row flex items-stretch gap-2 px-4 py-2 cursor-pointer"
    :class="{ 'server-row--pinned': pinned }"
    role="button"
    tabindex="0"
    :aria-label="t('shared.edit')"
    :data-testid="`server-row-${server.name || server.ip}`"
    @click="emit('edit')"
    @keydown.enter.prevent="emit('edit')"
    @keydown.space.prevent="emit('edit')"
  >
    <!-- Server icon (Minecraft-style 32x32 favicon) -->
    <div class="server-row__icon">
      <img
        v-if="iconSrc"
        :src="iconSrc"
        class="server-row__icon-img"
        :alt="server.name"
      >
      <v-icon
        v-else
        size="28"
        :color="pinned ? 'primary' : undefined"
      >
        {{ pinned ? 'push_pin' : 'dns' }}
      </v-icon>
    </div>

    <!-- Name + MOTD -->
    <div class="flex flex-col justify-center min-w-0 flex-grow">
      <div class="flex items-center gap-2 min-w-0">
        <span class="server-row__name truncate">
          {{ server.name || server.ip }}
        </span>
        <v-chip
          v-if="pinned"
          size="x-small"
          color="primary"
          variant="tonal"
          data-testid="launch-target-server"
        >
          {{ t('server.launchPinned') }}
        </v-chip>
      </div>
      <div class="server-row__motd truncate">
        <TextComponent
          v-if="hasDescription"
          :source="descriptionSource"
        />
        <span v-else class="text-gray-500">{{ server.ip }}</span>
      </div>
    </div>

    <!-- Status: player count + ping bars (Minecraft-style) -->
    <div class="flex flex-col items-end justify-center gap-1 flex-shrink-0">
      <div
        class="server-row__signal"
        v-shared-tooltip="() => pingTooltip"
        :aria-label="pingTooltip"
      >
        <span
          v-for="bar in 5"
          :key="bar"
          class="server-row__bar"
          :class="{ 'server-row__bar--on': bar <= signalLevel }"
          :style="{ height: `${bar * 2 + 2}px` }"
        />
      </div>
      <span
        v-if="status.players.online >= 0"
        class="text-xs text-gray-400 whitespace-nowrap flex items-center gap-0.5"
      >
        <v-icon size="11" color="primary" aria-hidden="true">group</v-icon>
        {{ status.players.online }}/{{ status.players.max }}
      </span>
    </div>

    <!-- Row actions -->
    <div class="flex items-center flex-shrink-0">
      <v-btn
        :icon="pinned ? 'push_pin' : 'push_pin_outline'"
        size="small"
        variant="text"
        :color="pinned ? 'primary' : 'default'"
        v-shared-tooltip="() => pinned ? t('server.unpin') : t('server.pin')"
        :aria-label="pinned ? t('server.unpin') : t('server.pin')"
        :data-testid="`server-pin-${server.name || server.ip}`"
        @click.stop="emit('pin')"
      />
      <v-btn
        icon="delete"
        size="small"
        variant="text"
        color="red"
        v-shared-tooltip="() => t('shared.remove')"
        :aria-label="t('shared.remove')"
        :data-testid="`server-remove-${server.name || server.ip}`"
        @click.stop="emit('remove')"
      />
    </div>
  </div>
</template>

<script setup lang="ts">
import TextComponent from '@/components/TextComponent'
import { kInstance } from '@/composables/instance'
import { useMinecraftProtocol } from '@/composables/protocol'
import { useServerStatus } from '@/composables/serverStatus'
import { vSharedTooltip } from '@/directives/sharedTooltip'
import { injection } from '@/util/inject'
import { parseServerAddress, ServerInfoWithStatus } from '@xmcl/runtime-api'

const props = defineProps<{
  server: ServerInfoWithStatus
  pinned?: boolean
  /** Bumped by the parent's "refresh all" button to force a re-ping. */
  refreshToken?: number
}>()

const emit = defineEmits<{
  (e: 'pin'): void
  (e: 'edit'): void
  (e: 'remove'): void
  (e: 'refreshed'): void
}>()

const { t } = useI18n()
const { instance } = injection(kInstance)

const parsed = computed(() => parseServerAddress(props.server.ip) ?? { host: '', port: undefined })
const serverRef = computed(() => ({ host: parsed.value.host, port: parsed.value.port }))
const protocol = useMinecraftProtocol(computed(() => instance.value?.runtime.minecraft))
const { status, refresh, refreshIfStale } = useServerStatus(serverRef, protocol)

onMounted(() => {
  if (parsed.value.host) {
    refreshIfStale()
  }
})

// Force a re-ping whenever the parent bumps the shared refresh token, then
// report completion so the parent can clear its aggregate loading state.
watch(() => props.refreshToken, async (v, old) => {
  if (v === undefined || v === old) return
  if (parsed.value.host) {
    await refresh()
  }
  emit('refreshed')
})

// Prefer the live favicon from the latest ping; fall back to the static
// servers.dat icon when the server has not been reached yet.
const iconSrc = computed(() => {
  const raw = status.value.favicon || props.server.icon
  if (!raw) return ''
  return raw.startsWith('data:') ? raw : `data:image/png;base64,${raw}`
})

const hasDescription = computed(() => {
  const d = status.value.description
  if (!d) return false
  if (typeof d === 'string') return d.length > 0 && d !== 'server.unknownDescription'
  return true
})
const descriptionSource = computed(() => {
  const d = status.value.description
  return typeof d === 'string' ? { text: d } : d
})

// Map a ping value to a 0..5 connection-bar level, mirroring how the vanilla
// Minecraft multiplayer list renders signal strength.
const signalLevel = computed(() => {
  const ping = status.value.ping
  if (ping < 0) return 0
  if (ping < 150) return 5
  if (ping < 300) return 4
  if (ping < 600) return 3
  if (ping < 1000) return 2
  return 1
})
const pingTooltip = computed(() => (status.value.ping >= 0 ? `${status.value.ping}ms` : t('server.unknown')))
</script>

<style scoped>
.server-row {
  border-radius: 8px;
  transition: background-color 0.15s ease;
}
.server-row:hover {
  background-color: rgba(255, 255, 255, 0.04);
}
.server-row--pinned {
  background: rgba(59, 130, 246, 0.08);
}
.server-row__icon {
  width: 36px;
  height: 36px;
  display: flex;
  align-items: center;
  justify-content: center;
  flex-shrink: 0;
}
.server-row__icon-img {
  width: 36px;
  height: 36px;
  border-radius: 4px;
  image-rendering: pixelated;
}
.server-row__name {
  font-weight: 600;
  font-size: 0.95rem;
}
.server-row__motd {
  font-size: 0.78rem;
  opacity: 0.75;
}
.server-row__signal {
  display: flex;
  align-items: flex-end;
  gap: 2px;
  height: 14px;
}
.server-row__bar {
  width: 3px;
  border-radius: 1px;
  background-color: rgba(128, 128, 128, 0.35);
}
.server-row__bar--on {
  background-color: rgb(var(--v-theme-primary));
}
</style>
