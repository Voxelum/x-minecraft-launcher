<template>
  <div
    class="version-card"
    :class="{ 'version-card--installed': version.installed }"
  >
    <div
      class="version-card__row"
      role="button"
      tabindex="0"
      :aria-label="version.name"
      :aria-pressed="version.installed"
      @click="emit('click', version)"
      @keydown.enter.prevent="emit('click', version)"
      @keydown.space.prevent="emit('click', version)"
    >
      <!-- Status accent + identity -->
      <div
        class="version-card__accent"
        :style="{ backgroundColor: color }"
      />
      <div class="version-card__identity">
        <div class="version-card__title-row">
          <span class="version-card__name">{{ version.name }}</span>
          <v-chip
            size="x-small"
            label
            variant="tonal"
            :style="{ color, borderColor: color }"
            class="version-card__type"
          >
            {{ t(`versionType.${version.type}`) }}
          </v-chip>
          <v-chip
            v-if="version.installed"
            size="x-small"
            label
            color="primary"
            variant="flat"
            class="version-card__installed-chip"
          >
            <v-icon start size="x-small">check</v-icon>
            {{ t('shared.installed') }}
          </v-chip>
        </div>
        <div class="version-card__version">
          {{ version.version }}
        </div>
      </div>

      <!-- Loader & MC version -->
      <div class="version-card__compat">
        <div class="version-card__loaders">
          <template v-for="loader of loaders" :key="loader.loader">
            <v-icon
              v-if="loader.icon"
              v-shared-tooltip="loader.loader"
              size="small"
            >
              {{ loader.icon }}
            </v-icon>
            <span v-else class="version-card__loader-text">
              {{ loader.loader }}
            </span>
          </template>
        </div>
        <div
          v-if="version.minecraftVersion"
          class="version-card__mc"
        >
          <v-icon size="x-small">sports_esports</v-icon>
          {{ version.minecraftVersion }}
        </div>
      </div>

      <!-- Metadata -->
      <div class="version-card__meta">
        <div v-if="version.downloadCount" class="version-card__meta-item">
          <v-icon size="x-small">file_download</v-icon>
          {{ t('downloadCount', { count: version.downloadCount }) }}
        </div>
        <div v-if="version.createdDate" class="version-card__meta-item">
          <v-icon size="x-small">event</v-icon>
          {{ getLocalDateString(version.createdDate) }}
        </div>
      </div>

      <v-icon
        size="small"
        class="version-card__chevron"
        :class="{ 'version-card__chevron--open': showChangelog }"
      >
        expand_more
      </v-icon>
    </div>

    <v-expand-transition>
      <div v-if="showChangelog" :key="`${version.id}-changelog`" class="version-card__changelog">
        <div class="version-card__changelog-header">
          <v-icon size="x-small" class="mr-1">history</v-icon>
          {{ t('shared.description') }}
        </div>
        <div
          v-if="!version.changelogLoading"
          class="markdown-body version-card__changelog-body"
          v-html="version.changelog || '—'"
        />
        <v-skeleton-loader
          v-else
          type="paragraph"
        />
      </div>
    </v-expand-transition>
  </div>
</template>

<script setup lang="ts">
import { useVuetifyColor } from '@/composables/vuetify'
import { vSharedTooltip } from '@/directives/sharedTooltip'
import { getColorForReleaseType } from '@/util/color'
import { getLocalDateString } from '@/util/date'

const props = defineProps<{
  version: ProjectVersion
  showChangelog: boolean
}>()

const emit = defineEmits(['install', 'click'])

export interface ProjectVersion {
  id: string
  name: string
  version: string
  disabled: boolean
  installed: boolean
  type: 'release' | 'alpha' | 'beta'
  downloadCount: number
  loaders: string[]
  minecraftVersion?: string
  createdDate?: string | number
  changelog?: string
  changelogLoading?: boolean
}

const loaders = computed(() => props.version.loaders.map(l => {
  if (l.toLowerCase() === 'vanilla') return { icon: 'xmcl:minecraft', loader: l }
  if (l.toLowerCase() === 'forge') return { icon: 'xmcl:forge', loader: l }
  if (l.toLowerCase() === 'fabric') return { icon: 'xmcl:fabric', loader: l }
  if (l.toLowerCase() === 'quilt') return { icon: 'xmcl:quilt', loader: l }
  if (l.toLowerCase() === 'neoforge') return { icon: 'xmcl:neoForged', loader: l }
  if (l.toLowerCase() === 'iris') return { icon: 'xmcl:iris', loader: l }
  if (l.toLowerCase() === 'optifine') return { icon: 'xmcl:optifine', loader: l }
  return { loader: l }
}))
const { getColorCode } = useVuetifyColor()
const color = computed(() => getColorCode(getColorForReleaseType(props.version.type)))
const { t } = useI18n()

</script>

<style scoped>
.version-card {
  border-radius: 8px;
  background-color: rgba(var(--v-theme-on-surface), 0.02);
  transition: background-color 0.2s ease;
  margin-bottom: 4px;
}
.version-card:hover {
  background-color: rgba(var(--v-theme-on-surface), 0.06);
}
.version-card--installed {
  background-color: rgba(var(--v-theme-primary), 0.06);
}
.version-card--installed:hover {
  background-color: rgba(var(--v-theme-primary), 0.1);
}

.version-card__row {
  display: grid;
  grid-template-columns: 4px minmax(0, 1.4fr) minmax(0, 1fr) minmax(0, 1fr) auto;
  align-items: center;
  gap: 12px;
  padding: 10px 12px 10px 0;
  cursor: pointer;
  user-select: none;
}

.version-card__accent {
  width: 4px;
  align-self: stretch;
  border-radius: 2px 0 0 2px;
}

.version-card__identity {
  min-width: 0;
}
.version-card__title-row {
  display: flex;
  align-items: center;
  gap: 6px;
  flex-wrap: wrap;
}
.version-card__name {
  font-weight: 500;
  font-size: 0.95rem;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  min-width: 0;
}
.version-card__type {
  flex-shrink: 0;
}
.version-card__installed-chip {
  flex-shrink: 0;
}
.version-card__version {
  font-size: 0.75rem;
  font-family: var(--v-monospace, ui-monospace, SFMono-Regular, Menlo, monospace);
  opacity: 0.65;
  margin-top: 2px;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.version-card__compat {
  min-width: 0;
}
.version-card__loaders {
  display: flex;
  align-items: center;
  gap: 6px;
  flex-wrap: wrap;
}
.version-card__loader-text {
  font-size: 0.75rem;
  opacity: 0.75;
}
.version-card__mc {
  display: inline-flex;
  align-items: center;
  gap: 4px;
  font-size: 0.75rem;
  opacity: 0.7;
  margin-top: 4px;
}

.version-card__meta {
  min-width: 0;
  display: flex;
  flex-direction: column;
  gap: 2px;
  font-size: 0.75rem;
  opacity: 0.7;
}
.version-card__meta-item {
  display: inline-flex;
  align-items: center;
  gap: 4px;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.version-card__chevron {
  opacity: 0.5;
  transition: transform 0.2s ease;
}
.version-card__chevron--open {
  transform: rotate(180deg);
}

.version-card__changelog {
  padding: 4px 16px 12px 16px;
  border-top: 1px solid rgba(var(--v-theme-on-surface), 0.08);
  margin-top: 2px;
}
.version-card__changelog-header {
  display: flex;
  align-items: center;
  font-size: 0.7rem;
  font-weight: 500;
  text-transform: uppercase;
  letter-spacing: 0.04em;
  opacity: 0.6;
  padding: 8px 0 6px 0;
}
.version-card__changelog-body {
  max-height: 280px;
  overflow: auto;
  font-size: 0.875rem;
  user-select: text;
}
</style>
