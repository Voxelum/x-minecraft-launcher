<template>
  <div
    class="mx-auto flex w-full max-w-5xl flex-col gap-4 p-6"
    data-testid="modpack-deployment"
  >
    <SettingCard title="Deploy a server modpack" icon="cloud_upload">
      <div class="flex flex-col gap-4 p-4">
        <v-alert type="info" variant="tonal">
          The package is uploaded as opaque data. XMCL does not inspect, trust, or execute package contents.
          Server validation resolves every mod through Modrinth or CurseForge before deployment.
        </v-alert>

        <input
          ref="packageInput"
          class="hidden"
          data-testid="modpack-package-input"
          type="file"
          accept=".mrpack,.zip,application/zip"
          @change="onPackageChange"
        >
        <div class="surface-panel flex flex-wrap items-center gap-3 p-4">
          <v-icon size="28">folder_zip</v-icon>
          <div class="min-w-0 flex-1">
            <div class="font-medium">
              {{ state.selectedPackage.value?.name || 'No package selected' }}
            </div>
            <div class="text-sm opacity-60">
              <template v-if="state.selectedPackage.value">
                {{ formatBytes(state.selectedPackage.value.size) }} ·
                {{ state.sourceFormat.value === 'mrpack' ? 'Modrinth mrpack' : 'CurseForge ZIP' }}
              </template>
              <template v-else>
                Select one .mrpack or CurseForge .zip file
              </template>
            </div>
          </div>
          <v-btn
            data-testid="modpack-package-select"
            variant="tonal"
            prepend-icon="folder_open"
            :disabled="state.busy.value"
            @click="packageInput?.click()"
          >
            Select package
          </v-btn>
          <v-btn
            data-testid="modpack-package-upload"
            color="primary"
            variant="flat"
            prepend-icon="cloud_upload"
            :loading="state.phase.value === 'uploading' || state.phase.value === 'validating'"
            :disabled="!state.selectedPackage.value || state.busy.value"
            @click="run(state.uploadAndValidate)"
          >
            Upload and validate
          </v-btn>
        </div>

        <div
          v-if="state.currentTask.value && state.busy.value"
          class="flex items-center gap-3 text-sm"
          aria-live="polite"
          data-testid="modpack-task-status"
        >
          <v-progress-circular indeterminate size="20" width="2" />
          Task {{ state.currentTask.value.taskId }}: {{ state.currentTask.value.status }}
        </div>
      </div>
    </SettingCard>

    <v-alert
      v-if="state.error.value"
      data-testid="modpack-deployment-error"
      type="error"
      variant="tonal"
      aria-live="assertive"
    >
      <div class="font-medium">{{ state.error.value.message }}</div>
      <div class="mt-1 text-xs opacity-70">
        {{ state.error.value.code }}
        <template v-if="state.error.value.requestId">
          · Request {{ state.error.value.requestId }}
        </template>
      </div>
      <template v-if="state.error.value.retryable" #append>
        <v-btn
          data-testid="modpack-deployment-retry"
          variant="text"
          @click="run(state.retry)"
        >
          Retry
        </v-btn>
      </template>
    </v-alert>

    <SettingCard
      v-if="state.report.value"
      title="Server validation report"
      :icon="state.report.value.status === 'valid' ? 'verified' : 'dangerous'"
      data-testid="modpack-validation-report"
    >
      <div class="flex flex-col gap-4 p-4">
        <v-alert
          :type="state.report.value.status === 'valid' ? 'success' : 'error'"
          variant="tonal"
        >
          {{ state.report.value.status === 'valid'
            ? 'The server accepted the complete package. Review every category before continuing.'
            : 'The server rejected the complete package. Nothing can be partially deployed.' }}
        </v-alert>

        <div class="grid gap-4 md:grid-cols-2">
          <ReportList
            title="Config files"
            icon="settings"
            data-testid="modpack-validation-config"
            :items="state.report.value.configFiles"
            empty-label="No config files"
          />
          <ReportList
            title="Data files"
            icon="storage"
            data-testid="modpack-validation-data"
            :items="state.report.value.dataFiles"
            empty-label="No data files"
          />
        </div>

        <section
          class="surface-panel p-4"
          data-testid="modpack-validation-mods"
        >
          <h3 class="mb-3 flex items-center gap-2 font-medium">
            <v-icon size="18">extension</v-icon>
            Provider-resolved mods
          </h3>
          <div v-if="state.report.value.mods.length" class="flex flex-col gap-2">
            <div
              v-for="mod in state.report.value.mods"
              :key="`${mod.provider}:${mod.projectId}:${mod.fileId}`"
              class="flex flex-wrap items-center gap-2 rounded px-2 py-1"
            >
              <v-chip
                size="small"
                :color="mod.provider === 'modrinth' ? 'green' : 'orange'"
              >
                {{ mod.provider }}
              </v-chip>
              <span class="font-medium">{{ mod.filename }}</span>
              <span class="text-xs opacity-60">{{ mod.projectId }} / {{ mod.fileId }}</span>
            </div>
          </div>
          <div v-else class="text-sm opacity-60">No provider-resolved mods</div>
        </section>

        <section
          class="surface-panel p-4"
          data-testid="modpack-validation-rejections"
        >
          <h3 class="mb-3 flex items-center gap-2 font-medium">
            <v-icon size="18" color="error">block</v-icon>
            Rejected files and sources
          </h3>
          <div v-if="state.report.value.rejectedFiles.length" class="flex flex-col gap-2">
            <v-alert
              v-for="rejection in state.report.value.rejectedFiles"
              :key="`${rejection.path}:${rejection.reason}`"
              type="error"
              density="compact"
              variant="tonal"
            >
              <span class="font-mono">{{ rejection.path || '(package)' }}</span>
              — {{ rejection.reason }}
            </v-alert>
          </div>
          <div v-else class="text-sm text-green-500">No rejected files or sources</div>
        </section>

        <v-checkbox
          v-model="state.reportConfirmed.value"
          data-testid="modpack-report-confirm"
          :disabled="state.report.value.status !== 'valid'"
          hide-details
          label="I reviewed this server validation report, including config/data files, provider sources, and rejections."
        />
        <div class="flex justify-end">
          <v-btn
            data-testid="modpack-preview-generate"
            color="primary"
            variant="tonal"
            prepend-icon="difference"
            :loading="state.phase.value === 'preparing-preview'"
            :disabled="!state.canPreparePreview.value"
            @click="run(state.preparePreview)"
          >
            Generate deployment preview
          </v-btn>
        </div>
      </div>
    </SettingCard>

    <SettingCard
      v-if="state.preview.value"
      title="Deployment preview"
      icon="difference"
      data-testid="modpack-deployment-preview"
    >
      <div class="flex flex-col gap-4 p-4">
        <div class="grid gap-4 md:grid-cols-3">
          <PreviewList title="Config changes" :items="state.preview.value.configFiles" />
          <PreviewList title="Data changes" :items="state.preview.value.dataFiles" />
          <section class="surface-panel p-4">
            <h3 class="mb-3 font-medium">Mod changes</h3>
            <div v-if="state.preview.value.mods.length" class="flex flex-col gap-2 text-sm">
              <div
                v-for="mod in state.preview.value.mods"
                :key="`${mod.provider}:${mod.projectId}:${mod.fileId}`"
                class="flex items-center gap-2"
              >
                <ChangeChip :change="mod.change" />
                <span>{{ mod.provider }} {{ mod.projectId }}/{{ mod.fileId }}</span>
              </div>
            </div>
            <div v-else class="text-sm opacity-60">No mod changes</div>
          </section>
        </div>

        <v-alert
          v-for="warning in state.preview.value.warnings"
          :key="warning"
          type="warning"
          variant="tonal"
        >
          {{ warning }}
        </v-alert>

        <v-checkbox
          v-model="state.previewConfirmed.value"
          data-testid="modpack-preview-confirm"
          hide-details
          label="I reviewed this immutable deployment preview and want the worker to stage and atomically apply it."
        />
        <div class="flex flex-wrap justify-end gap-2">
          <v-btn
            v-if="state.canRollback.value && state.phase.value !== 'applied'"
            data-testid="modpack-deployment-rollback"
            color="warning"
            variant="tonal"
            prepend-icon="restore"
            :loading="state.phase.value === 'rolling-back'"
            @click="run(state.rollback)"
          >
            Restore rollback snapshot
          </v-btn>
          <v-btn
            data-testid="modpack-deployment-apply"
            color="primary"
            variant="flat"
            prepend-icon="rocket_launch"
            :loading="state.phase.value === 'applying'"
            :disabled="!state.canApply.value"
            @click="run(state.apply)"
          >
            Apply deployment
          </v-btn>
        </div>
      </div>
    </SettingCard>

    <v-alert
      v-if="state.phase.value === 'applied' || state.phase.value === 'rolled-back'"
      data-testid="modpack-deployment-success"
      type="success"
      variant="tonal"
      aria-live="polite"
    >
      {{ state.phase.value === 'applied'
        ? 'Deployment applied after worker staging and verification.'
        : 'The rollback snapshot was restored.' }}
      <template #append>
        <v-btn
          v-if="state.phase.value === 'applied'"
          data-testid="modpack-deployment-rollback"
          color="warning"
          variant="text"
          @click="run(state.rollback)"
        >
          Roll back
        </v-btn>
      </template>
    </v-alert>
  </div>
</template>

<script setup lang="ts">
import SettingCard from '@/components/SettingCard.vue'
import { useModpackDeployment } from '@/composables/modpackDeployment'
import type { ModpackDeploymentService } from '@xmcl/runtime-api/src/services/ModpackDeploymentService'
import ChangeChip from './modpack-deployment/ChangeChip.vue'
import PreviewList from './modpack-deployment/PreviewList.vue'
import ReportList from './modpack-deployment/ReportList.vue'

const props = defineProps<{
  serverId: string
  service: ModpackDeploymentService
}>()

const packageInput = ref<HTMLInputElement>()
const state = useModpackDeployment(props.service, {
  serverId: () => props.serverId,
})

function onPackageChange(event: Event) {
  const file = (event.target as HTMLInputElement).files?.[0]
  if (!file) return
  try {
    state.selectPackage({
      name: file.name,
      size: file.size,
      type: file.type,
      body: file,
    })
  } catch {
    // The composable exposes selection failures in the view's error alert.
  }
}

async function run(action: () => Promise<void>) {
  try {
    await action()
  } catch {
    // The composable normalizes API, provider, worker, and conflict errors.
  }
}

function formatBytes(value: number) {
  if (value < 1024) return `${value} B`
  if (value < 1024 * 1024) return `${(value / 1024).toFixed(1)} KiB`
  return `${(value / 1024 / 1024).toFixed(1)} MiB`
}
</script>
