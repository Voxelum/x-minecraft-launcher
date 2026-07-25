<template>
  <v-list-item :data-testid="`minecraft-friend-row-${friend.profileId}`">
    <template #prepend>
      <div class="relative mr-2">
        <v-avatar
          size="36"
          :color="avatarColor"
        >
          <img
            v-if="avatarUrl && !imageFailed"
            :src="avatarUrl"
            :alt="friend.name"
            width="36"
            height="36"
            style="image-rendering: pixelated"
            @error="imageFailed = true"
          >
          <span v-else class="text-white text-subtitle-2">{{ initial }}</span>
        </v-avatar>
        <span
          class="absolute -bottom-0.5 -right-0.5 w-3.5 h-3.5 rounded-full border-2 border-[rgb(var(--v-theme-surface))]"
          :class="{
            'bg-green-500': effectiveStatus === 'online',
            'bg-purple-500': effectiveStatus === 'playing',
            'bg-amber-500': effectiveStatus === 'away',
            'bg-gray-400 opacity-60': effectiveStatus === 'offline',
          }"
          :title="presenceStatusText"
        />
      </div>
    </template>
    <v-list-item-title class="font-medium flex items-center gap-1.5">
      <span>{{ friend.name }}</span>
      <v-chip
        size="x-small"
        label
        density="compact"
        class="text-[10px] h-4 px-1.5"
        :color="effectiveStatus === 'playing' ? 'purple' : effectiveStatus === 'away' ? 'amber' : effectiveStatus === 'online' ? 'success' : 'grey'"
        variant="tonal"
      >
        {{ presenceStatusText }}
      </v-chip>
    </v-list-item-title>
    <v-list-item-subtitle v-if="subtitle" :title="absoluteDate">
      {{ subtitle }}
    </v-list-item-subtitle>
    <template #append>
      <div class="flex items-center gap-1">
        <slot />
      </div>
    </template>
  </v-list-item>
</template>

<script lang="ts" setup>
import type { MinecraftFriend, XboxPresenceInfo } from '@xmcl/runtime-api'
import type { FriendPresenceInfo } from '@/composables/useFriendsPresence'
import {
  formatRelativeTime,
  useReactiveNow,
} from '@/composables/minecraftFriends'
import { computed, ref } from 'vue'

const props = defineProps<{
  friend: MinecraftFriend
  presence?: FriendPresenceInfo
  busy?: string
}>()

const { t } = useI18n()
const now = useReactiveNow(60_000)
const imageFailed = ref(false)

const initial = computed(() => (props.friend.name?.[0] ?? '?').toUpperCase())

const palette = ['indigo', 'teal', 'orange', 'pink', 'green', 'cyan', 'deep-purple', 'amber']
const avatarColor = computed(() => {
  const id = props.friend.profileId || props.friend.name || ''
  let hash = 0
  for (let i = 0; i < id.length; i++) hash = (hash * 31 + id.charCodeAt(i)) >>> 0
  return palette[hash % palette.length]
})

const avatarUrl = computed(() => {
  const id = props.friend.profileId
  if (!id) return ''
  return `https://mc-heads.net/avatar/${id}/36`
})

const effectiveStatus = computed<'offline' | 'online' | 'playing' | 'away'>(() => {
  if (props.presence) {
    return props.presence.status
  }
  const xbox = props.friend.xboxPresence
  if (xbox) {
    const st = (xbox.state || '').toLowerCase()
    if (st === 'online') {
      return xbox.titleName ? 'playing' : 'online'
    }
    if (st === 'away') return 'away'
  }
  return 'offline'
})

const presenceStatusText = computed(() => {
  if (props.presence?.instanceName) {
    return `${t('presence.playing', { game: props.presence.instanceName }, `Playing ${props.presence.instanceName}`)}`
  }
  if (props.friend.xboxPresence?.titleName) {
    return `${t('presence.playing', { game: props.friend.xboxPresence.titleName }, `Playing ${props.friend.xboxPresence.titleName}`)}`
  }
  switch (effectiveStatus.value) {
    case 'playing': return t('presence.playingGeneric', 'Playing')
    case 'online': return t('presence.online', 'Online')
    case 'away': return t('presence.away', 'Away')
    default: return t('presence.offline', 'Offline')
  }
})

const referenceTimestamp = computed(() => {
  const raw = props.friend.expiresAt ?? props.friend.addedAt
  if (!raw) return 0
  const ms = Date.parse(raw)
  return isNaN(ms) ? 0 : ms
})

const subtitle = computed(() => {
  if (effectiveStatus.value !== 'offline') {
    if (props.presence?.instanceName) {
      return `${props.presence.instanceName}${props.presence.version ? ` (${props.presence.version})` : ''}`
    }
    if (props.friend.xboxPresence?.titleName) {
      return props.friend.xboxPresence.titleName
    }
    return presenceStatusText.value
  }
  if (referenceTimestamp.value) {
    const r = formatRelativeTime(referenceTimestamp.value, now.value)
    if (r) {
      const relative = r.count === 0
        ? t('relative.justNow')
        : t(r.key, { count: r.count }, r.count)
      return props.friend.expiresAt
        ? t('minecraftFriends.expiresRelative', { time: relative })
        : t('minecraftFriends.addedRelative', { time: relative })
    }
  }
  return presenceStatusText.value
})

const absoluteDate = computed(() => {
  const raw = props.friend.expiresAt ?? props.friend.addedAt
  if (!raw) return ''
  const d = new Date(raw)
  return isNaN(d.getTime()) ? raw : d.toLocaleString()
})
</script>

