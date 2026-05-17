<template>
  <v-card
    class="upstream-version"
    :outlined="outlined"
    :style="{
      'content-visibility': 'auto',
      'backdrop-filter': `blur(${blurCard}px)`,
      '--release-color': getColorCode(getColorForReleaseType(version.versionType)),
    }"
    :color="cardColor"
  >
    <!-- Header row: title + release badge + actions -->
    <div class="upstream-version__header">
      <div class="upstream-version__title-block">
        <div class="upstream-version__name">
          {{ version.name }}
        </div>
        <div class="upstream-version__meta">
          <span class="upstream-version__release-badge">
            {{ t(`versionType.${version.versionType}`) }}
          </span>
          <span class="upstream-version__version-number">
            {{ version.versionNumber }}
          </span>
        </div>
      </div>
      <div class="upstream-version__actions">
        <v-btn
          v-shared-tooltip="t('instances.add')"
          :loading="duplicating"
          variant="text"
          size="small"
          icon
          @click="$emit('duplicate', version)"
        >
          <v-icon>add</v-icon>
        </v-btn>
        <v-btn
          v-if="!noAction"
          :color="downgrade ? 'warning' : 'primary'"
          :loading="updating"
          variant="tonal"
          size="small"
          @click="$emit('update', version)"
        >
          {{ downgrade ? t('upstream.downgrade') : t('upstream.update') }}
          <v-icon end size="18">
            {{ downgrade ? 'keyboard_double_arrow_down' : 'upgrade' }}
          </v-icon>
        </v-btn>
        <v-btn
          v-else
          color="primary"
          :loading="updating"
          variant="tonal"
          size="small"
          @click="$emit('update', version)"
        >
          {{ t('instances.fix') }}
          <v-icon end size="18">build</v-icon>
        </v-btn>
      </div>
    </div>

    <!-- Metadata row -->
    <div class="upstream-version__metadata">
      <span
        v-if="version.loaders.length > 0"
        class="upstream-version__chip"
      >
        <template v-for="(l, i) of version.loaders" :key="l">
          <v-icon
            v-if="getLoader(l)"
            v-shared-tooltip="l"
            size="14"
            :class="{ 'ml-1': i > 0 }"
          >
            {{ getLoader(l) }}
          </v-icon>
          <span
            v-else
            :class="{ 'ml-1': i > 0 }"
          >{{ l }}</span>
        </template>
      </span>
      <span
        v-if="version.gameVersions.length > 0"
        v-shared-tooltip="version.gameVersions.join(', ')"
        class="upstream-version__chip"
      >
        <v-icon size="14" class="material-icons-outlined">sports_esports</v-icon>
        {{ version.gameVersions.length === 1 ? version.gameVersions[0] : `${version.gameVersions[0]} +${version.gameVersions.length - 1}` }}
      </span>
      <span class="upstream-version__chip">
        <v-icon size="14" class="material-icons-outlined">file_download</v-icon>
        {{ t('downloadCount', { count: version.downloads }) }}
      </span>
      <span class="upstream-version__chip">
        <v-icon size="14" class="material-icons-outlined">schedule</v-icon>
        {{ getDateString(version.datePublished, { timeStyle: 'short', dateStyle: 'long' }) }}
      </span>
    </div>

    <!-- Changelog -->
    <div
      v-if="version.changelog"
      :key="`${version.id}-changelog`"
      class="upstream-version__changelog-wrapper"
    >
      <div
        class="markdown-body upstream-version__changelog"
        v-html="version.changelog"
      />
    </div>
  </v-card>
</template>

<script lang="ts" setup>
import { useDateString } from '@/composables/date'
import { kTheme } from '@/composables/theme'
import { useVuetifyColor } from '@/composables/vuetify'
import { vSharedTooltip } from '@/directives/sharedTooltip'
import { getColorForReleaseType } from '@/util/color'
import { injection } from '@/util/inject'

export interface ProjectVersionProps {
  id: string
  name: string
  versionType: 'release' | 'beta' | 'alpha'
  versionNumber: string
  loaders: string[]
  gameVersions: string[]
  downloads: number
  datePublished: string
  changelog: string
}

const props = defineProps<{
  version: ProjectVersionProps
  downgrade?: boolean
  color?: string
  noAction?: boolean
  outlined?: boolean
  duplicating?: boolean
  updating?: boolean
}>()

const emit = defineEmits(['update', 'duplicate', 'changelog'])
const { cardColor, blurCard } = injection(kTheme)
const version = computed(() => props.version)
const { getColorCode } = useVuetifyColor()
const { t } = useI18n()
const getLoader = (loader: string) => {
  loader = loader.toLowerCase()
  if (loader === 'forge') return 'xmcl:forge'
  if (loader === 'fabric') return 'xmcl:fabric'
  if (loader === 'neoforge') return 'xmcl:neoForged'
  if (loader === 'quilt') return 'xmcl:quilt'
  return ''
}
const { getDateString } = useDateString()

watch(() => props.version, () => {
  emit('changelog')
}, { immediate: true })
</script>

<style scoped>
.upstream-version {
  display: flex;
  flex-direction: column;
  gap: 10px;
  padding: 14px 16px;
  border-radius: 12px;
  border: 1px solid transparent;
  border-left: 3px solid var(--release-color);
  transition: border-color 0.5s ease;
  color: rgba(var(--v-theme-on-surface), 0.85);
}

.upstream-version:hover {
  border-color: color-mix(in srgb, var(--release-color) 45%, transparent);
  border-left-color: var(--release-color);
}

.upstream-version__header {
  display: flex;
  align-items: flex-start;
  gap: 12px;
}

.upstream-version__title-block {
  flex: 1;
  min-width: 0;
  display: flex;
  flex-direction: column;
  gap: 2px;
}

.upstream-version__name {
  font-size: 1rem;
  font-weight: 700;
  line-height: 1.3;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.upstream-version__meta {
  display: flex;
  align-items: center;
  gap: 8px;
  font-size: 0.75rem;
  opacity: 0.85;
  min-width: 0;
}

.upstream-version__release-badge {
  display: inline-flex;
  align-items: center;
  padding: 2px 8px;
  border-radius: 999px;
  background-color: color-mix(in srgb, var(--release-color) 18%, transparent);
  color: var(--release-color);
  font-weight: 700;
  font-size: 0.65rem;
  text-transform: uppercase;
  letter-spacing: 0.05em;
  flex-shrink: 0;
}

.upstream-version__version-number {
  font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace;
  font-size: 0.7rem;
  opacity: 0.7;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.upstream-version__actions {
  display: flex;
  align-items: center;
  gap: 4px;
  flex-shrink: 0;
}

.upstream-version__metadata {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 6px;
}

.upstream-version__chip {
  display: inline-flex;
  align-items: center;
  gap: 5px;
  padding: 3px 10px;
  border-radius: 999px;
  background-color: rgba(128, 128, 128, 0.12);
  font-size: 0.7rem;
  font-weight: 500;
  white-space: nowrap;
}

.upstream-version__changelog-wrapper {
  margin-top: 4px;
}

.upstream-version__changelog {
  max-height: 35rem;
  overflow: auto;
  padding: 12px 14px;
  border-radius: 8px;
  background-color: rgba(0, 0, 0, 0.06);
  color: rgba(var(--v-theme-on-surface), 0.7);
  font-size: 0.85rem;
  user-select: text;
  transition: color 0.15s ease, background-color 0.15s ease;
}

.upstream-version__changelog:hover {
  background-color: rgba(0, 0, 0, 0.09);
  color: rgba(var(--v-theme-on-surface), 1);
}

.dark .upstream-version__changelog {
  background-color: rgba(0, 0, 0, 0.35);
}

.dark .upstream-version__changelog:hover {
  background-color: rgba(0, 0, 0, 0.5);
}
</style>
