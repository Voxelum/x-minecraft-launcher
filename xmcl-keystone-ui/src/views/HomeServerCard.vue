<template>
  <HomeCard
    icon="dns"
    :title="title"
    :text="address"
    :icons="[]"
    :refreshing="false"
    :button="{ text: t('shared.refresh'), icon: 'refresh' }"
    @navigate="refresh"
  >
    <div class="flex flex-col gap-2">
      <!-- Top row: favicon + address + players/ping -->
      <div class="flex items-center gap-3">
        <img
          v-if="status.favicon"
          :src="status.favicon"
          class="h-10 w-10 rounded flex-shrink-0"
          style="image-rendering: pixelated"
        >
        <v-icon v-else size="28" color="primary" class="flex-shrink-0">dns</v-icon>

        <div class="min-w-0 flex-grow">
          <div class="text-sm font-medium truncate">
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
import { useMinecraftProtocol } from '@/composables/protocol'
import { useServerStatus } from '@/composables/serverStatus'
import { vSharedTooltip } from '@/directives/sharedTooltip'
import { injection } from '@/util/inject'

const { t } = useI18n()
const { instance } = injection(kInstance)

const server = computed(() => instance.value?.server ?? { host: '' })
const displayName = computed(() => instance.value?.server?.name || instance.value?.server?.host || '')
const address = computed(() => {
  const s = instance.value?.server
  if (!s?.host) return ''
  return s.port && s.port !== 25565 ? `${s.host}:${s.port}` : s.host
})
const title = computed(() => displayName.value || t('server.serversListTitle'))

const protocol = useMinecraftProtocol(computed(() => instance.value?.runtime.minecraft))
const { status, refresh, refreshIfStale } = useServerStatus(server, protocol)

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
