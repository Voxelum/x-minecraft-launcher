<template>
  <div
    ref="root"
    class="server-list-item flex items-center w-full gap-2 pl-1 pr-1 h-7 cursor-pointer rounded"
    role="button"
    tabindex="0"
    :aria-label="server.name || server.ip"
    :class="{ 'server-list-item--pinned': pinned }"
    @click="emit('pin')"
    @keydown.enter.prevent="emit('pin')"
    @keydown.space.prevent="emit('pin')"
  >
    <img
      v-if="server.icon"
      :src="iconSrc"
      class="server-list-item__icon"
      :alt="server.name"
    />
    <v-icon
      v-else
      size="14"
      :color="pinned ? 'primary' : undefined"
      class="flex-shrink-0"
    >
      {{ pinned ? 'push_pin' : 'dns' }}
    </v-icon>

    <span
      v-shared-tooltip="() => server.ip"
      class="server-list-item__text transition-colors whitespace-nowrap overflow-hidden text-ellipsis flex-shrink min-w-0"
      :style="textStyle"
    >
      {{ server.name || server.ip }}
    </span>

    <div class="flex-grow" />

    <span
      v-if="status.players.online >= 0"
      class="text-xs text-gray-400 whitespace-nowrap flex items-center gap-0.5"
    >
      <v-icon size="11" color="primary" aria-hidden="true">group</v-icon>
      {{ status.players.online }}/{{ status.players.max }}
    </span>
    <span
      v-if="status.ping > 0"
      class="text-xs text-gray-500 whitespace-nowrap"
    >
      {{ status.ping }}ms
    </span>

    <v-btn
      v-if="isHovered || pinned"
      :icon="pinned ? 'push_pin' : 'push_pin'"
      size="x-small"
      variant="text"
      :color="pinned ? 'primary' : 'default'"
      :aria-label="pinned ? t('server.unpin') : t('server.pin')"
      v-shared-tooltip="() => pinned ? t('server.unpin') : t('server.pin')"
      @click.stop="emit('pin')"
    />
  </div>
</template>

<script setup lang="ts">
import { kTheme } from '@/composables/theme'
import { kInstance } from '@/composables/instance'
import { useMinecraftProtocol } from '@/composables/protocol'
import { useServerStatus } from '@/composables/serverStatus'
import { vSharedTooltip } from '@/directives/sharedTooltip'
import { injection } from '@/util/inject'
import { useElementHover } from '@vueuse/core'
import type { ServerInfoWithStatus } from '@xmcl/runtime-api'

const props = defineProps<{
  server: ServerInfoWithStatus
  pinned?: boolean
  /** Skip the auto-ping on mount; useful when a parent already drives refresh. */
  noAutoRefresh?: boolean
}>()

const emit = defineEmits<{
  (e: 'pin'): void
}>()

const { t } = useI18n()
const { isDark } = injection(kTheme)
const { instance } = injection(kInstance)
const root = ref<HTMLElement | null>(null)
const isHovered = useElementHover(root, { delayLeave: 150 })

const iconSrc = computed(() => {
  const raw = props.server.icon
  if (!raw) return ''
  return raw.startsWith('data:') ? raw : `data:image/png;base64,${raw}`
})

const parsed = computed(() => parseIp(props.server.ip))
const serverRef = computed(() => ({ host: parsed.value.host, port: parsed.value.port }))
const protocol = useMinecraftProtocol(computed(() => instance.value?.runtime.minecraft))
const { status, refreshIfStale } = useServerStatus(serverRef, protocol)

onMounted(() => {
  if (!props.noAutoRefresh && parsed.value.host) {
    refreshIfStale()
  }
})

const textStyle = computed(() => ({
  color: props.pinned
    ? 'var(--highlight-color)'
    : isHovered.value
      ? (isDark.value ? 'rgba(255,255,255,0.95)' : 'rgba(0,0,0,0.87)')
      : (isDark.value ? 'rgba(255,255,255,0.55)' : 'rgba(0,0,0,0.55)'),
  fontWeight: props.pinned ? 600 : 400,
}))

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

<style scoped>
.server-list-item__icon {
  width: 16px;
  height: 16px;
  border-radius: 3px;
  flex-shrink: 0;
}
.server-list-item--pinned {
  background: rgba(59, 130, 246, 0.06);
}
</style>
