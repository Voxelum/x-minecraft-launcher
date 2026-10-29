<script lang="ts" setup>
import { useService } from '@/composables'
import { useDialog } from '@/composables/dialog'
import { kInstance } from '@/composables/instance'
import { kInstanceModsContext } from '@/composables/instanceMods'
import { injection } from '@/util/inject'
import { ModFile } from '@/util/mod'
import { InstanceModsServiceKey } from '@xmcl/runtime-api'

const { isShown } = useDialog('mod-duplicated')
const { conflicted } = injection(kInstanceModsContext)

const conflictList = computed(() => {
  return Object.entries(conflicted.value).map(([modId, files]) => ({
    modId,
    files,
  }))
})

function selectDefault(files: ModFile[]) {
  return files.toSorted((a, b) => !a.enabled ? 1 : b.mtime - a.mtime)[0]
}

function selectDefaults(all: Record<string, ModFile[]>) {
  const newOmitted = {} as Record<string, ModFile>
  for (const [modId, files] of Object.entries(all)) {
    newOmitted[modId] = selectDefault(files)
  }
  omitted.value = newOmitted
}

watch(conflicted, (all) => {
  selectDefaults(all)
})

const omitted = ref({} as Record<string, ModFile>)
const onSelect = (item: ModFile) => {
  omitted.value[item.modId] = item
}

const { t } = useI18n()

const { uninstall } = useService(InstanceModsServiceKey)
const { path } = injection(kInstance)

function process() {
  const omittedSet = new Set(Object.values(omitted.value))
  const paths = [] as string[]
  for (const files of Object.values(conflicted.value)) {
    for (const file of files) {
      if (!omittedSet.has(file)) {
        paths.push(file.path)
      }
    }
  }
  uninstall({ files: paths, path: path.value })
  isShown.value = false
}

const { push, currentRoute } = useRouter()

function view(modId: string) {
  const all = conflicted.value[modId]
  if (!all) return
  for (const file of all) {
    const modrinthId = file.modrinth?.projectId
    const curseforgeId = file.curseforge?.projectId
    const name = file.name
    const id = modrinthId || curseforgeId || name
    push({ query: { ...currentRoute.value.query, id: id.toString() } })
    isShown.value = false
    return
  }
}

function formatSize(bytes?: number) {
  if (!bytes) return ''
  const mb = bytes / (1024 * 1024)
  return `${mb.toFixed(2)} MB`
}
</script>

<template>
  <v-dialog
    v-model="isShown"
    width="820"
    content-class="elevation-0"
  >
    <v-card class="flex flex-col overflow-hidden max-h-[85vh] rounded-2xl border border-white/10 bg-surface/95 backdrop-blur-xl">
      <!-- Header -->
      <div class="flex items-center gap-3 p-6 pb-4 border-b border-white/5">
        <div
          class="w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0"
          style="background-color: rgba(var(--v-theme-warning), 0.15)"
        >
          <v-icon size="22" color="warning">warning_amber</v-icon>
        </div>
        <div class="flex flex-col flex-grow">
          <div class="text-base font-bold tracking-tight" style="color: rgba(var(--v-theme-on-surface), 0.9);">
            {{ t('mod.duplicatedDetected', { count: Object.keys(conflicted).length }) }}
          </div>
          <div class="text-xs text-medium-emphasis mt-0.5">
            {{ t('mod.duplicatedDetectedDescription') }}
          </div>
        </div>
        <v-btn
          icon="close"
          variant="text"
          size="small"
          @click="isShown = false"
        />
      </div>

      <!-- Conflicted Groups List -->
      <div class="overflow-y-auto visible-scroll p-6 flex flex-col gap-4">
        <div
          v-for="group in conflictList"
          :key="group.modId"
          class="rounded-xl border border-white/10 bg-white/[0.02] p-4 flex flex-col gap-2.5"
        >
          <div class="flex items-center justify-between pb-1">
            <div class="flex items-center gap-2">
              <v-icon size="18" color="primary">extension</v-icon>
              <span class="font-bold text-sm text-high-emphasis">{{ group.modId }}</span>
              <v-chip size="x-small" variant="tonal" color="warning">
                {{ group.files.length }} {{ t('version.name') || 'versions' }}
              </v-chip>
            </div>
            <v-btn
              size="x-small"
              variant="tonal"
              color="primary"
              append-icon="arrow_forward"
              @click="view(group.modId)"
            >
              {{ t('shared.view') || 'View' }}
            </v-btn>
          </div>

          <div class="flex flex-col gap-1.5">
            <div
              v-for="file in group.files"
              :key="file.fileName"
              class="flex items-center justify-between p-3 rounded-lg border transition-all duration-200 cursor-pointer"
              :class="omitted[group.modId] === file
                ? 'border-primary/50 bg-primary/10 shadow-sm'
                : 'border-white/5 bg-white/[0.01] hover:bg-white/[0.03] opacity-60'"
              @click="onSelect(file)"
            >
              <div class="flex items-center gap-3 min-w-0">
                <v-checkbox-btn
                  :model-value="omitted[group.modId] === file"
                  readonly
                  hide-details
                  density="compact"
                  color="primary"
                  @click.stop="onSelect(file)"
                />
                <div class="flex flex-col min-w-0">
                  <span class="font-mono text-xs font-semibold truncate text-high-emphasis">
                    {{ file.fileName }}
                  </span>
                  <div class="flex items-center gap-2 text-[11px] text-medium-emphasis mt-0.5">
                    <span v-if="file.version">v{{ file.version }}</span>
                    <span v-if="file.size">• {{ formatSize(file.size) }}</span>
                  </div>
                </div>
              </div>

              <div class="flex items-center gap-1.5">
                <v-chip
                  size="x-small"
                  :color="file.enabled ? 'success' : 'surface-variant'"
                  variant="tonal"
                >
                  {{ file.enabled ? t('shared.enable') : t('shared.disable') }}
                </v-chip>
                <v-chip
                  v-if="omitted[group.modId] === file"
                  size="x-small"
                  color="primary"
                  variant="flat"
                >
                  <v-icon start size="10">check</v-icon>
                  {{ t('shared.keepSelected') || 'Keep' }}
                </v-chip>
              </div>
            </div>
          </div>
        </div>
      </div>

      <!-- Actions -->
      <div class="flex items-center px-6 py-4 border-t border-white/5 bg-surface-variant/5">
        <v-btn
          variant="tonal"
          size="small"
          prepend-icon="auto_fix_high"
          @click="selectDefaults(conflicted)"
        >
          {{ t('shared.filter') }}
        </v-btn>
        <v-spacer />
        <v-btn
          variant="text"
          size="small"
          class="mr-2"
          @click="isShown = false"
        >
          {{ t('shared.cancel') }}
        </v-btn>
        <v-btn
          color="primary"
          variant="flat"
          rounded="lg"
          size="small"
          prepend-icon="delete_sweep"
          @click="process"
        >
          {{ t('shared.keepSelected') }}
        </v-btn>
      </div>
    </v-card>
  </v-dialog>
</template>
