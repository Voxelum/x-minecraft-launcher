<script setup lang="ts">
import { useWorldBackups } from '@/composables/worldBackups'
import type { InstanceSaveFile } from '@/composables/instanceSave'
import type { BackupFormat } from '@xmcl/instance'
import { kInstance } from '@/composables/instance'
import { injection } from '@/util/inject'

const props = defineProps<{ save: InstanceSaveFile }>()
const { path: instancePath } = injection(kInstance)
const {
  backups,
  storage,
  prepared,
  loading,
  uploading,
  restoring,
  error,
  refresh,
  prepare,
  upload,
  getChain,
  restore,
} = useWorldBackups()

const format = ref<BackupFormat>('linear')
const parentBackupId = ref<string>()
const source = computed(() => ({ instancePath: instancePath.value, saveName: props.save.name }))
const parentCandidates = computed(() => backups.value.filter(backup => backup.status === 'ready'))
const readyBackups = computed(() => backups.value.filter(backup => backup.status === 'ready'))

const formatBytes = (bytes: number) => {
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 ** 2) return `${(bytes / 1024).toFixed(1)} KiB`
  if (bytes < 1024 ** 3) return `${(bytes / 1024 ** 2).toFixed(1)} MiB`
  return `${(bytes / 1024 ** 3).toFixed(2)} GiB`
}

const load = () => {
  refresh(source.value)
}
const prepareBackup = async () => {
  await prepare(source.value, format.value, format.value === 'layered_linear' ? parentBackupId.value : undefined)
  if (prepared.value) await refresh(source.value)
}
const uploadBackup = async () => {
  await upload()
  await refresh(source.value)
}
const restoreBackup = async (backup: typeof readyBackups.value[number]) => {
  await restore(source.value, backup)
}

onMounted(load)
watch(() => props.save.name, load)
watch(format, (next) => {
  if (next === 'linear') parentBackupId.value = undefined
})
</script>

<template>
  <section data-testid="world-backups" class="flex flex-col gap-3 p-4">
    <div class="flex items-center gap-2">
      <v-icon>backup</v-icon>
      <div>
        <div class="text-subtitle-1">World backups</div>
        <div class="text-caption opacity-70">Manual backups for this selected player world only.</div>
      </div>
      <v-spacer />
      <v-btn size="small" variant="text" icon="refresh" :loading="loading" @click="load" />
    </div>

    <v-alert v-if="error" type="error" density="compact" variant="tonal">
      {{ error.message }}
    </v-alert>

    <div v-if="storage" class="rounded border border-current border-opacity-20 p-3 text-body-2">
      <div class="flex justify-between gap-2"><span>Free capacity</span><strong>{{ formatBytes(storage.policy.freeBytes) }}</strong></div>
      <div class="flex justify-between gap-2"><span>Current use</span><strong>{{ formatBytes(storage.usedBytes) }}</strong></div>
      <div class="flex justify-between gap-2"><span>Overage</span><strong>{{ formatBytes(storage.overageBytes) }}</strong></div>
      <div class="mt-2 text-caption opacity-70">
        Only overage retention is settled
        <template v-if="storage.settlement"> · {{ storage.settlement.amount }} {{ storage.settlement.currency }}</template>.
      </div>
    </div>

    <div class="grid grid-cols-1 gap-2 sm:grid-cols-2">
      <v-select
        v-model="format"
        label="Compressed backup format"
        :items="[{ title: 'Linear', value: 'linear' }, { title: 'Layered Linear', value: 'layered_linear' }]"
        hide-details
        density="compact"
      />
      <v-select
        v-if="format === 'layered_linear'"
        v-model="parentBackupId"
        label="Parent backup"
        :items="parentCandidates.map(backup => ({ title: backup.backupId, value: backup.backupId }))"
        hide-details
        density="compact"
      />
    </div>
    <v-btn
      data-testid="world-backups-prepare"
      color="primary"
      prepend-icon="backup"
      :disabled="format === 'layered_linear' && !parentBackupId"
      @click="prepareBackup"
    >
      Prepare compressed backup
    </v-btn>

    <div v-if="prepared" class="rounded border border-current border-opacity-20 p-3 text-body-2">
      <div class="font-weight-medium">Compressed object ready to upload</div>
      <div>Format: {{ prepared.object.format }} v{{ prepared.object.formatVersion }}</div>
      <div>Compressed size: {{ formatBytes(prepared.object.sizeBytes) }}</div>
      <div class="break-all">SHA-256: {{ prepared.object.sha256 }}</div>
      <div v-if="'parentBackupId' in prepared.object">Parent layer: {{ prepared.object.parentBackupId }}</div>
      <div class="mt-2 text-caption opacity-70">The source directory, region files, and ZIP files are never uploaded.</div>
      <v-btn
        data-testid="world-backups-upload"
        class="mt-3"
        color="primary"
        :loading="uploading"
        :disabled="storage?.uploadBlockedReason === 'insufficient_balance'"
        @click="uploadBackup"
      >
        Upload compressed object
      </v-btn>
    </div>

    <div v-if="backups.length" class="flex flex-col gap-2">
      <div class="text-subtitle-2">Backup chain</div>
      <div v-for="backup in backups" :key="backup.backupId" class="rounded border border-current border-opacity-20 p-3 text-body-2">
        <div class="flex items-center gap-2">
          <strong>{{ backup.backupId }}</strong>
          <v-chip size="x-small">{{ backup.status }}</v-chip>
          <v-spacer />
          <v-btn
            v-if="backup.status === 'ready'"
            data-testid="world-backups-restore"
            size="small"
            variant="tonal"
            :loading="restoring"
            @click="restoreBackup(backup)"
          >
            Restore selected world
          </v-btn>
        </div>
        <div>Source: player world {{ props.save.name }} · {{ backup.format }} v{{ backup.formatVersion }}</div>
        <div v-if="backup.sizeBytes">Compressed size: {{ formatBytes(backup.sizeBytes) }}</div>
        <div>Parent chain: {{ getChain(backup.backupId).map(item => item.backupId).join(' → ') }}</div>
        <div class="text-caption opacity-70">Restore overwrites only <code>saves/{{ props.save.name }}</code> after you click Restore.</div>
      </div>
    </div>
  </section>
</template>
