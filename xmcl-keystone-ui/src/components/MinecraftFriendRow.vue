<template>
  <v-list-item :data-testid="`minecraft-friend-row-${friend.profileId}`">
    <template #prepend>
      <v-avatar
        size="36"
        :color="avatarColor"
        class="mr-2"
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
    </template>
    <v-list-item-title class="font-medium">
      {{ friend.name }}
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
import type { MinecraftFriend } from '@xmcl/runtime-api'
import {
  formatRelativeTime,
  useReactiveNow,
} from '@/composables/minecraftFriends'
import { computed, ref } from 'vue'

const props = defineProps<{
  friend: MinecraftFriend
  busy?: string
}>()

const { t } = useI18n()
const now = useReactiveNow(60_000)
const imageFailed = ref(false)

const initial = computed(() => (props.friend.name?.[0] ?? '?').toUpperCase())

// Pick a stable color from a palette based on the profile id, so the same
// friend always gets the same avatar color when the network avatar fails.
const palette = ['indigo', 'teal', 'orange', 'pink', 'green', 'cyan', 'deep-purple', 'amber']
const avatarColor = computed(() => {
  const id = props.friend.profileId || props.friend.name || ''
  let hash = 0
  for (let i = 0; i < id.length; i++) hash = (hash * 31 + id.charCodeAt(i)) >>> 0
  return palette[hash % palette.length]
})

// Resolve the player head via mc-heads.net. UUIDs from the friends API can
// arrive either dashed or undashed; mc-heads accepts both.
const avatarUrl = computed(() => {
  const id = props.friend.profileId
  if (!id) return ''
  return `https://mc-heads.net/avatar/${id}/36`
})

const referenceTimestamp = computed(() => {
  const raw = props.friend.expiresAt ?? props.friend.addedAt
  if (!raw) return 0
  const ms = Date.parse(raw)
  return isNaN(ms) ? 0 : ms
})

const subtitle = computed(() => {
  if (!referenceTimestamp.value) return ''
  const r = formatRelativeTime(referenceTimestamp.value, now.value)
  if (!r) return ''
  const relative = r.count === 0
    ? t('relative.justNow')
    : t(r.key, { count: r.count }, r.count)
  return props.friend.expiresAt
    ? t('minecraftFriends.expiresRelative', { time: relative })
    : t('minecraftFriends.addedRelative', { time: relative })
})

const absoluteDate = computed(() => {
  const raw = props.friend.expiresAt ?? props.friend.addedAt
  if (!raw) return ''
  const d = new Date(raw)
  return isNaN(d.getTime()) ? raw : d.toLocaleString()
})
</script>
