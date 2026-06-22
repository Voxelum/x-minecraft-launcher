<template>
  <v-dialog
    v-model="isShown"
    width="720"
    transition="fade-transition"
    content-class="elevation-0"
  >
    <div
      data-testid="unresolved-files-dialog"
      class="select-none flex max-h-[90vh] flex-col overflow-hidden rounded-xl"
      style="background-color: rgba(var(--v-theme-surface), 1)"
    >
      <!-- Header -->
      <div class="flex items-center px-6 pt-6 pb-3">
        <div class="flex items-center gap-3 flex-grow">
          <div
            class="w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0"
            style="background-color: rgba(var(--v-theme-warning), 0.12)"
          >
            <v-icon size="22" color="warning">help_outline</v-icon>
          </div>
          <div>
            <div class="text-base font-bold tracking-tight" style="color: rgba(var(--v-theme-on-surface), 0.9);">
              {{ t('unresolvedFiles.title') }}
            </div>
            <div class="text-xs opacity-60">
              {{ t('unresolvedFiles.description') }}
            </div>
          </div>
        </div>
        <v-btn
          icon="close"
          variant="text"
          size="small"
          @click="isShown = false"
        />
      </div>

      <v-divider />

      <!-- Empty state -->
      <div
        v-if="entries.length === 0"
        class="flex flex-1 flex-col items-center justify-center gap-3 px-6 py-16 opacity-60"
      >
        <v-icon size="48" color="primary">check_circle</v-icon>
        <div class="text-sm">{{ t('unresolvedFiles.empty') }}</div>
      </div>

      <!-- File list -->
      <div
        v-else
        class="visible-scroll flex flex-col gap-2 overflow-y-auto px-4 py-3"
      >
        <div
          v-for="entry of entries"
          :key="entry.file.path"
          data-testid="unresolved-file-item"
          class="flex cursor-pointer select-none items-center gap-3 rounded-lg px-3 py-2 transition-colors hover:brightness-125"
          style="background-color: rgba(var(--v-theme-on-surface), 0.04)"
          @click="entry.ignore = !entry.ignore"
        >
          <v-checkbox
            :model-value="entry.ignore"
            readonly
            hide-details
            density="compact"
            color="warning"
            :label="''"
            class="pointer-events-none flex-shrink-0"
          />
          <div class="flex flex-col min-w-0 flex-grow">
            <div class="flex items-center gap-2">
              <span class="truncate text-sm font-medium">{{ entry.fileName }}</span>
              <v-chip
                v-if="entry.resolved"
                size="x-small"
                variant="tonal"
                color="primary"
                label
              >
                <v-icon start size="x-small">{{ matchIcon(entry.matchedBy) }}</v-icon>
                {{ entry.matchName || t('unresolvedFiles.matched') }}
              </v-chip>
              <v-chip
                v-else
                size="x-small"
                variant="tonal"
                color="warning"
                label
              >
                {{ t('unresolvedFiles.noMatch') }}
              </v-chip>
            </div>
            <div class="truncate text-[10px] opacity-50">
              <span v-if="entry.file.hashes.sha1">sha1: {{ entry.file.hashes.sha1 }}</span>
              <span v-else>{{ entry.file.path }}</span>
            </div>
          </div>
          <span v-if="entry.matchedBy" class="flex-shrink-0 text-[10px] opacity-50">
            {{ t('unresolvedFiles.via', { source: t(`unresolvedFiles.source.${entry.matchedBy}`) }) }}
          </span>
        </div>
      </div>

      <ErrorView :error="searchError || installError" />

      <v-divider />

      <!-- Actions -->
      <div class="flex items-center gap-2 px-6 py-4">
        <v-btn
          data-testid="unresolved-files-search"
          variant="tonal"
          color="primary"
          :loading="searching"
          :disabled="entries.length === 0"
          prepend-icon="search"
          @click="search"
        >
          {{ t('unresolvedFiles.search') }}
        </v-btn>
        <v-spacer />
        <v-btn
          v-if="ignoredEntries.length > 0"
          data-testid="unresolved-files-ignore"
          variant="text"
          color="warning"
          prepend-icon="block"
          @click="onIgnore"
        >
          {{ t('unresolvedFiles.ignoreSelected', { count: ignoredEntries.length }) }}
        </v-btn>
        <v-btn
          data-testid="unresolved-files-install"
          variant="elevated"
          color="primary"
          :loading="installing"
          :disabled="matchedEntries.length === 0"
          prepend-icon="get_app"
          @click="onInstall"
        >
          {{ t('unresolvedFiles.install', { count: matchedEntries.length }) }}
        </v-btn>
      </div>
    </div>
  </v-dialog>
</template>

<script lang="ts" setup>
import ErrorView from '@/components/ErrorView.vue'
import { useDialog } from '@/composables/dialog'
import { kInstanceFiles } from '@/composables/instanceFiles'
import { UnresolvedFilesDialogKey } from '@/composables/instanceUpdate'
import { UnresolvedMatchSource, useUnresolvedFiles } from '@/composables/unresolvedFiles'
import { injection } from '@/util/inject'

const { t } = useI18n()
const { isShown, show } = useDialog(UnresolvedFilesDialogKey)
const { unresolvedFiles } = injection(kInstanceFiles)

const {
  entries,
  search,
  searching,
  searchError,
  install,
  installing,
  installError,
  ignoreSelected,
  matchedEntries,
  ignoredEntries,
} = useUnresolvedFiles()

function matchIcon(source?: UnresolvedMatchSource) {
  if (source === 'dependency') return 'account_tree'
  if (source === 'curseforge-name') return 'xmcl:curseforge'
  return 'xmcl:modrinth'
}

async function onInstall() {
  await install()
}

async function onIgnore() {
  await ignoreSelected()
}

// Surface the dialog automatically right after an install finishes and leaves
// behind unresolved files. Only react to the empty -> non-empty transition so
// it does not pop every time the home view mounts with pre-existing leftovers.
watch(() => unresolvedFiles.value?.length ?? 0, (count, previous) => {
  if (count > 0 && (previous ?? 0) === 0 && !isShown.value) {
    show()
  }
})
</script>
