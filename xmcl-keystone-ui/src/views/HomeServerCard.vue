<template>
  <HomeCard
    data-testid="home-server-card"
    icon="dns"
    :title="title"
    :text="address"
    :icons="[]"
    :refreshing="false"
    :button="{ text: t('shared.refresh'), icon: 'refresh' }"
    :addition-button="{ text: t('launch.launch'), icon: 'play_arrow', testid: 'server-card-play' }"
    @navigate="refresh"
    @navigate-addition="onPlay"
  >
    <div class="flex flex-col gap-2">
      <!-- Top row: favicon + address + players/ping -->
      <div class="flex items-center gap-3">
        <img
          v-if="favicon"
          :src="favicon"
          class="h-10 w-10 rounded flex-shrink-0"
          style="image-rendering: pixelated"
        >
        <v-icon v-else size="28" color="primary" class="flex-shrink-0">dns</v-icon>

        <div class="min-w-0 flex-grow">
          <!-- When there are multiple servers, the name acts as a switcher -->
          <v-menu v-if="candidates.length > 1" location="bottom start">
            <template #activator="{ props: menuProps }">
              <button
                v-bind="menuProps"
                class="no-drag flex items-center gap-1 min-w-0 max-w-full text-left"
                type="button"
              >
                <span class="text-sm font-medium truncate">{{ displayName }}</span>
                <v-icon size="16" class="flex-shrink-0">arrow_drop_down</v-icon>
              </button>
            </template>
            <v-list density="compact" min-width="200">
              <v-list-item
                v-for="(s, i) in candidates"
                :key="`${s.host}:${s.port ?? 25565}`"
                :title="s.name || s.host"
                :subtitle="formatAddress(s)"
                :active="i === selectedIndex"
                @click="selectedIndex = i"
              />
            </v-list>
          </v-menu>
          <div v-else class="text-sm font-medium truncate">
            {{ displayName }}
          </div>
          <div class="text-xs text-medium-emphasis truncate">
            {{ address }}
          </div>
        </div>

        <div class="flex flex-col items-end flex-shrink-0">
          <div
            class="server-card__signal"
            v-shared-tooltip="() => pingTooltip"
          >
            <span
              v-for="bar in 5"
              :key="bar"
              class="server-card__bar"
              :class="{ 'server-card__bar--on': bar <= signalLevel }"
              :style="{ height: `${bar * 2 + 2}px` }"
            />
          </div>
          <span
            v-if="status.players.online >= 0"
            class="text-xs text-medium-emphasis whitespace-nowrap flex items-center gap-0.5 mt-1"
          >
            <v-icon size="11" color="primary" aria-hidden="true">group</v-icon>
            {{ status.players.online }}/{{ status.players.max }}
          </span>
        </div>
      </div>

      <!-- MOTD -->
      <div v-if="hasDescription" class="text-xs text-medium-emphasis server-card__motd">
        <TextComponent :source="descriptionSource" />
      </div>
    </div>
  </HomeCard>
</template>
<script lang="ts" setup>
import HomeCard from '@/components/HomeCard.vue'
import TextComponent from '@/components/TextComponent'
import { kInstance } from '@/composables/instance'
import { kInstanceLaunch } from '@/composables/instanceLaunch'
import { kInstanceServerInfo } from '@/composables/instanceServerInfo'
import { useMinecraftProtocol } from '@/composables/protocol'
import { useServerStatus } from '@/composables/serverStatus'
import { vSharedTooltip } from '@/directives/sharedTooltip'
import { injection } from '@/util/inject'
import { parseServerAddress } from '@xmcl/runtime-api'

interface CardServer {
  host: string
  port?: number
  name?: string
  icon?: string
}

const { t } = useI18n()
const { instance } = injection(kInstance)
const { servers: datServers } = injection(kInstanceServerInfo)
const { launch } = injection(kInstanceLaunch)

const props = defineProps<{
  /** `host[:port]` to pin this card to a single server. */
  serverKey?: string
}>()

function formatAddress(s: { host: string; port?: number }) {
  if (!s.host) return ''
  return s.port && s.port !== 25565 ? `${s.host}:${s.port}` : s.host
}

function toDataUrl(icon?: string) {
  if (!icon) return ''
  return icon.startsWith('data:') ? icon : `data:image/png;base64,${icon}`
}

// The card works whether or not the instance has a pinned server: the pinned
// server (if any) is shown first, followed by the remaining entries from
// `servers.dat`, de-duplicated by host:port.
const allCandidates = computed<CardServer[]>(() => {
  const list: CardServer[] = []
  const pinned = instance.value?.server
  if (pinned?.host) {
    list.push({ host: pinned.host, port: pinned.port, name: pinned.name })
  }
  for (const s of datServers.value) {
    const parsed = parseServerAddress(s.ip)
    if (!parsed) continue
    if (pinned?.host && pinned.host === parsed.host && (pinned.port ?? 25565) === (parsed.port ?? 25565)) continue
    list.push({ host: parsed.host, port: parsed.port, name: s.name, icon: s.icon })
  }
  return list
})

// When pinned to a specific server, show only that one (no switcher). Fall back
// to a bare entry built from the key if it isn't in the known list (yet).
const candidates = computed<CardServer[]>(() => {
  if (!props.serverKey) return allCandidates.value
  const target = parseServerAddress(props.serverKey)
  if (!target) return allCandidates.value
  const match = allCandidates.value.find((c) => c.host === target.host && (c.port ?? 25565) === (target.port ?? 25565))
  return match ? [match] : [{ host: target.host, port: target.port }]
})

const selectedIndex = ref(0)
watch(candidates, (list) => {
  if (selectedIndex.value >= list.length) selectedIndex.value = 0
})

const current = computed<CardServer>(() => candidates.value[selectedIndex.value] ?? { host: '' })
const server = computed(() => ({ host: current.value.host, port: current.value.port }))
const displayName = computed(() => current.value.name || current.value.host || '')
const address = computed(() => formatAddress(current.value))
// The card title is the server's name, falling back to its address, so each
// per-server card is identifiable at a glance.
const title = computed(() => current.value.name || address.value || t('server.serversListTitle'))

const protocol = useMinecraftProtocol(computed(() => instance.value?.runtime.minecraft))
const { status, refresh, refreshIfStale } = useServerStatus(server, protocol)

// Prefer the live favicon from the latest ping, fall back to the static
// servers.dat icon.
const favicon = computed(() => status.value.favicon || toDataUrl(current.value.icon))

function onPlay() {
  if (!current.value.host) return
  launch('client', { server: { host: current.value.host, port: current.value.port } })
}

let refreshInterval: number | undefined
onMounted(() => {
  if (server.value.host) {
    refreshIfStale()
    refreshInterval = window.setInterval(() => {
      if (server.value.host) refresh()
    }, 5 * 60 * 1000)
  }
})
onUnmounted(() => {
  if (refreshInterval) clearInterval(refreshInterval)
})
// Re-ping when the user switches to a different server in the dropdown.
watch(server, () => {
  if (server.value.host) refreshIfStale()
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

// Map a ping value to a 0..5 connection-bar level, mirroring the vanilla
// Minecraft multiplayer list.
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
.server-card__signal {
  display: flex;
  align-items: flex-end;
  gap: 2px;
  height: 14px;
}
.server-card__bar {
  width: 3px;
  border-radius: 1px;
  background-color: rgba(128, 128, 128, 0.35);
}
.server-card__bar--on {
  background-color: rgb(var(--v-theme-primary));
}
.server-card__motd {
  display: -webkit-box;
  -webkit-line-clamp: 2;
  -webkit-box-orient: vertical;
  overflow: hidden;
}
</style>
