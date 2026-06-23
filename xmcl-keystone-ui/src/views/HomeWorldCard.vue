<template>
  <HomeCard
    data-testid="home-world-card"
    icon="map"
    :title="displayName || t('save.world')"
    :text="t('save.noSavesInstalled')"
    :icons="[]"
    :refreshing="false"
    :button="{ text: t('shared.manage'), icon: 'settings' }"
    :addition-button="{ text: t('launch.launch'), icon: 'play_arrow', testid: 'world-card-play' }"
    @navigate="push('/save')"
    @navigate-addition="onPlay"
  >
    <div class="flex flex-col gap-2">
      <!-- Top row: world icon + name + version -->
      <div class="flex items-center gap-3">
        <img
          v-if="icon"
          :src="icon"
          class="h-10 w-10 rounded flex-shrink-0"
          style="image-rendering: pixelated"
          v-fallback-img="BuiltinImages.unknownServer"
        >
        <v-icon v-else size="28" color="primary" class="flex-shrink-0">map</v-icon>

        <div class="min-w-0 flex-grow">
          <!-- When there are multiple worlds, the name acts as a switcher -->
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
                :key="s.path"
                :title="s.levelName || s.name"
                :subtitle="s.gameVersion"
                :active="i === selectedIndex"
                @click="selectedIndex = i"
              />
            </v-list>
          </v-menu>
          <div v-else class="text-sm font-medium truncate">
            {{ displayName }}
          </div>
          <div class="text-xs text-medium-emphasis truncate">
            {{ subtitle }}
          </div>
        </div>

        <v-chip
          v-if="current && current.gameVersion"
          size="x-small"
          variant="tonal"
          color="primary"
          class="flex-shrink-0"
        >
          {{ current.gameVersion }}
        </v-chip>
      </div>
    </div>
  </HomeCard>
</template>
<script lang="ts" setup>
import HomeCard from '@/components/HomeCard.vue'
import { BuiltinImages } from '@/constant'
import { useDateString } from '@/composables/date'
import { kInstanceLaunch } from '@/composables/instanceLaunch'
import { kInstanceSave, InstanceSaveFile } from '@/composables/instanceSave'
import { vFallbackImg } from '@/directives/fallbackImage'
import { injection } from '@/util/inject'

const { t } = useI18n()
const { push } = useRouter()
const { getDateString } = useDateString()
const { saves } = injection(kInstanceSave)
const { launch } = injection(kInstanceLaunch)

const props = defineProps<{
  /** Save folder name to pin this card to a single world. */
  world?: string
}>()

// Most recently played world first.
const sorted = computed<InstanceSaveFile[]>(() =>
  [...saves.value].sort((a, b) => (b.lastPlayed ?? 0) - (a.lastPlayed ?? 0)),
)

// When pinned to a specific world, show only that one (no switcher). Fall back
// to the full list if the pinned world no longer exists.
const candidates = computed<InstanceSaveFile[]>(() => {
  if (!props.world) return sorted.value
  const match = sorted.value.filter((s) => s.name === props.world)
  return match.length ? match : sorted.value
})

const selectedIndex = ref(0)
watch(candidates, (list) => {
  if (selectedIndex.value >= list.length) selectedIndex.value = 0
})

const current = computed<InstanceSaveFile | undefined>(() => candidates.value[selectedIndex.value])
const displayName = computed(() => current.value?.levelName || current.value?.name || '')
const icon = computed(() => current.value?.icon?.replace(/\\/g, '\\\\') || '')

function getLevelMode(mode: number) {
  switch (mode) {
    case 0: return t('gameType.survival')
    case 1: return t('gameType.creative')
    case 2: return t('gameType.adventure')
    case 3: return t('gameType.spectator')
    default: return ''
  }
}

const subtitle = computed(() => {
  const s = current.value
  if (!s) return ''
  const parts: string[] = []
  const mode = getLevelMode(s.mode as unknown as number)
  if (mode) parts.push(mode)
  if (s.lastPlayed) parts.push(getDateString(s.lastPlayed))
  return parts.join(' · ')
})

function onPlay() {
  const s = current.value
  if (!s) return
  launch('client', { world: s.name })
}
</script>
