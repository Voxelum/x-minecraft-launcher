<template>
  <div>
    <v-dialog
      v-model="isShown"
      hide-overlay
      transition="dialog-bottom-transition"
      scrollable
      :width="creating ? 600 : 500"
    >
      <v-card>
        <v-toolbar class="moveable flex-1 flex-grow-0 rounded-none" tabs>
          <v-toolbar-title class="text-white">
            {{ t("setting.createBackup") }}
          </v-toolbar-title>

          <v-spacer />
          <v-btn class="non-moveable" icon @click="handleCancel">
            <v-icon>arrow_drop_down</v-icon>
          </v-btn>
        </v-toolbar>

        <v-card-text class="pa-4">
          <v-form v-if="!creating" ref="form" v-model="valid">
            <v-text-field
              v-model="backupName"
              :label="t('setting.backupFileName')"
              :rules="[(v) => !!v || t('setting.backupFileNameRequired')]"
              :hint="t('setting.backupFileNameHint')"
              persistent-hint
              required
            >
              <template #append>
                <span class="grey--text">.xmclsettings</span>
              </template>
            </v-text-field>

            <v-checkbox
              v-model="includeInstances"
              :label="t('setting.includeInstances')"
              :description="t('setting.includeInstancesDesc')"
              hide-details
            />

            <div
              v-if="includeInstances && instances.length > 0"
              class="ml-6 mt-2 mb-2"
            >
              <v-subheader class="pa-0">
                {{ t("setting.selectInstances") }}
              </v-subheader>
              <v-list
                dense
                class="pa-0"
                max-height="200"
                style="overflow-y: auto"
              >
                <v-list-item
                  v-for="instance in instances"
                  :key="instance.path"
                  @click="toggleInstance(instance.path)"
                >
                  <v-list-item-action>
                    <v-checkbox
                      :value="selectedInstances.includes(instance.path)"
                      :input-value="selectedInstances.includes(instance.path)"
                      readonly
                      dense
                    />
                  </v-list-item-action>
                  <v-list-item-content>
                    <v-list-item-title>{{
                      instance.name || instance.path.split("/").pop()
                    }}</v-list-item-title>
                    <v-list-item-subtitle class="text-caption">
                      {{ instance.version || "Unknown" }}
                    </v-list-item-subtitle>
                  </v-list-item-content>
                </v-list-item>
              </v-list>
              <div class="text-caption grey--text mt-1">
                {{
                  t("setting.selectedInstances", {
                    count: selectedInstances.length,
                    total: instances.length,
                  })
                }}
              </div>
            </div>

            <v-checkbox
              v-model="includeSettings"
              :label="t('setting.includeSettings')"
              :description="t('setting.includeSettingsDesc')"
              hide-details
            />

            <v-checkbox
              v-model="includeScreenshots"
              :label="t('setting.includeScreenshots')"
              :description="t('setting.includeScreenshotsDesc')"
              hide-details
            />
          </v-form>

          <div v-else>
            <v-progress-linear
              :value="progress"
              :total="total"
              :color="isFinalizing ? 'orange' : 'primary'"
              height="25"
              class="mb-2"
            >
              <template #default="{ value }">
                <strong>{{ Math.ceil(value) }}%</strong>
              </template>
            </v-progress-linear>

            <v-expansion-panels v-model="expanded" accordion>
              <v-expansion-panel>
                <v-expansion-panel-header>
                  {{ t("setting.backupProgress") }}
                </v-expansion-panel-header>
                <v-expansion-panel-content>
                  <v-list dense>
                    <v-list-item>
                      <v-list-item-icon>
                        <v-icon
                          :color="
                            phase === 'copying-instances'
                              ? 'primary'
                              : 'success'
                          "
                          :class="{
                            'pulse-icon': phase === 'copying-instances',
                          }"
                        >
                          {{
                            phase === "copying-instances"
                              ? "hourglass_full"
                              : "check_circle"
                          }}
                        </v-icon>
                      </v-list-item-icon>
                      <v-list-item-content>
                        <v-list-item-title>{{
                          t("setting.backupPhaseCopyingInstances")
                        }}</v-list-item-title>
                      </v-list-item-content>
                    </v-list-item>
                    <v-list-item>
                      <v-list-item-icon>
                        <v-icon
                          :color="
                            phase === 'copying-settings'
                              ? 'primary'
                              : phaseIndex > 1
                              ? 'success'
                              : 'grey'
                          "
                          :class="{
                            'pulse-icon': phase === 'copying-settings',
                          }"
                        >
                          {{
                            phase === "copying-settings"
                              ? "hourglass_full"
                              : phaseIndex > 1
                              ? "check_circle"
                              : "radio_button_unchecked"
                          }}
                        </v-icon>
                      </v-list-item-icon>
                      <v-list-item-content>
                        <v-list-item-title>{{
                          t("setting.backupPhaseCopyingSettings")
                        }}</v-list-item-title>
                      </v-list-item-content>
                    </v-list-item>
                    <v-list-item>
                      <v-list-item-icon>
                        <v-icon
                          :color="
                            phase === 'copying-screenshots'
                              ? 'primary'
                              : phaseIndex > 2
                              ? 'success'
                              : 'grey'
                          "
                          :class="{
                            'pulse-icon': phase === 'copying-screenshots',
                          }"
                        >
                          {{
                            phase === "copying-screenshots"
                              ? "hourglass_full"
                              : phaseIndex > 2
                              ? "check_circle"
                              : "radio_button_unchecked"
                          }}
                        </v-icon>
                      </v-list-item-icon>
                      <v-list-item-content>
                        <v-list-item-title>{{
                          t("setting.backupPhaseCopyingScreenshots")
                        }}</v-list-item-title>
                      </v-list-item-content>
                    </v-list-item>
                    <v-list-item>
                      <v-list-item-icon>
                        <v-icon
                          :color="
                            phase === 'creating-archive'
                              ? 'primary'
                              : phaseIndex > 3
                              ? 'success'
                              : 'grey'
                          "
                          :class="{
                            'pulse-icon': phase === 'creating-archive',
                          }"
                        >
                          {{
                            phase === "creating-archive"
                              ? "hourglass_full"
                              : phaseIndex > 3
                              ? "check_circle"
                              : "radio_button_unchecked"
                          }}
                        </v-icon>
                      </v-list-item-icon>
                      <v-list-item-content>
                        <v-list-item-title>{{
                          t("setting.backupPhaseCreatingArchive")
                        }}</v-list-item-title>
                      </v-list-item-content>
                    </v-list-item>
                    <v-list-item>
                      <v-list-item-icon>
                        <v-icon
                          :color="
                            isFinalizing
                              ? 'orange'
                              : phaseIndex > 4
                              ? 'success'
                              : 'grey'
                          "
                          :class="{
                            'pulse-icon': phase === 'finalizing',
                            'finalizing-icon': isFinalizing,
                          }"
                        >
                          {{
                            isFinalizing
                              ? "autorenew"
                              : phase === "finalizing"
                              ? "hourglass_full"
                              : phaseIndex > 4
                              ? "check_circle"
                              : "radio_button_unchecked"
                          }}
                        </v-icon>
                      </v-list-item-icon>
                      <v-list-item-content>
                        <v-list-item-title>{{
                          t("setting.backupPhaseFinalizing")
                        }}</v-list-item-title>
                      </v-list-item-content>
                    </v-list-item>
                  </v-list>

                  <v-divider class="my-2" />

                  <div class="text-caption grey--text">
                    {{
                      t("setting.backupFilesProgress", {
                        copied: copiedFiles,
                        total: totalFiles,
                      })
                    }}
                  </div>

                  <!-- Backup Log -->
                  <v-divider class="my-2" />
                  <div class="text-caption font-weight-medium mb-1">
                    {{ t("setting.backupLog") }}
                  </div>
                  <v-card
                    class="pa-2"
                    style="
                      background-color: #1e1e1e;
                      max-height: 150px;
                      overflow-y: auto;
                    "
                    flat
                  >
                    <div
                      v-for="(log, index) in backupLogs"
                      :key="index"
                      class="text-caption font-monospace"
                      :class="
                        log.type === 'warn'
                          ? 'orange--text'
                          : log.type === 'error'
                          ? 'red--text'
                          : 'white--text'
                      "
                    >
                      {{ log.message }}
                    </div>
                  </v-card>
                </v-expansion-panel-content>
              </v-expansion-panel>
            </v-expansion-panels>
          </div>

          <v-alert v-if="error" type="error" class="mt-3" dense>
            {{ error }}
          </v-alert>
        </v-card-text>

        <v-card-actions>
          <v-spacer />
          <v-btn
            text
            @click="handleCancel"
            :disabled="creating && isFinalizing"
          >
            {{ t("shared.cancel") }}
          </v-btn>
          <v-btn
            v-if="!creating"
            color="primary"
            :disabled="!valid || creating"
            @click="onCreateBackup"
          >
            <v-icon left>backup</v-icon>
            {{ t("setting.createBackup") }}
          </v-btn>
        </v-card-actions>
      </v-card>
    </v-dialog>

    <!-- Cancel Confirmation Dialog -->
    <v-dialog v-model="showCancelDialog" max-width="400">
      <v-card>
        <v-card-title class="headline">
          {{ t("setting.cancelBackupTitle") }}
        </v-card-title>
        <v-card-text>
          {{
            isFinalizing
              ? t("setting.cancelBackupFinalizingWarning")
              : t("setting.cancelBackupWarning")
          }}
        </v-card-text>
        <v-card-actions>
          <v-spacer />
          <v-btn text @click="showCancelDialog = false">
            {{ t("shared.continue") }}
          </v-btn>
          <v-btn color="error" text @click="confirmCancel">
            {{ t("setting.cancelBackup") }}
          </v-btn>
        </v-card-actions>
      </v-card>
    </v-dialog>

    <!-- Backup Complete Dialog -->
    <v-dialog v-model="showCompleteDialog" max-width="400" persistent>
      <v-card>
        <v-card-title class="headline">
          {{ t("setting.backupCompleteTitle") }}
        </v-card-title>
        <v-card-text>
          <v-icon color="success" size="48" class="mb-2">check_circle</v-icon>
          <p>{{ t("setting.backupCompleteMessage") }}</p>
          <p class="text-caption grey--text mt-2">
            {{ t("setting.backupCompleteHint") }}
          </p>
        </v-card-text>
        <v-card-actions>
          <v-spacer />
          <v-btn
            color="primary"
            @click="
              showCompleteDialog = false;
              cancel();
            "
          >
            {{ t("shared.ok") }}
          </v-btn>
        </v-card-actions>
      </v-card>
    </v-dialog>
  </div>
</template>

<script lang="ts" setup>
import { useDialog } from "@/composables/dialog";
import { useService, useTasks } from "@/composables";
import {
  BackupServiceKey,
  InstanceServiceKey,
  TaskState,
} from "@xmcl/runtime-api";
import { ref, computed, watch, onMounted } from "vue";
import { useI18n } from "vue-i18n-bridge";

const { t } = useI18n();
const { isShown, hide: cancel } = useDialog("backup", () => {
  resetForm();
});

const backupService = useService(BackupServiceKey);
const instanceService = useService(InstanceServiceKey);
const { showSaveDialog } = windowController;

const valid = ref(false);
const creating = ref(false);
const error = ref("");
const backupName = ref(`backup-${new Date().toISOString().slice(0, 10)}`);
const includeInstances = ref(true);
const includeSettings = ref(true);
const includeScreenshots = ref(false);
const expanded = ref([0]);
const showCancelDialog = ref(false);
const showCompleteDialog = ref(false);
const instances = ref<Array<{ path: string; name?: string; version?: string }>>(
  []
);
const selectedInstances = ref<string[]>([]);

// Load instances when dialog opens
onMounted(async () => {
  try {
    const state = await instanceService.getSharedInstancesState();
    instances.value = Object.values(state.all).map((inst: any) => ({
      path: inst.path,
      name: inst.name,
      version: inst.version,
    }));
    selectedInstances.value = instances.value.map((i) => i.path);
  } catch (e) {
    console.error("Failed to load instances:", e);
  }
});

function toggleInstance(path: string) {
  const index = selectedInstances.value.indexOf(path);
  if (index === -1) {
    selectedInstances.value.push(path);
  } else {
    selectedInstances.value.splice(index, 1);
  }
}

// Track backup task progress
const backupTasks = useTasks((task) => task.type === "createBackup");
const currentTask = computed(() => {
  const tasks = backupTasks.value;
  return (
    tasks.find((t) => t.state === TaskState.Running) || tasks[tasks.length - 1]
  );
});

const progress = computed(() => {
  if (!currentTask.value?.progress) return 0;
  const { progress: prog, total } = currentTask.value.progress as any;
  if (!total || total === 0) return 0;
  return Math.round((prog / total) * 100);
});

const total = computed(() => {
  return currentTask.value?.progress
    ? (currentTask.value.progress as any).total || 0
    : 0;
});

const phase = computed(() => {
  return ((currentTask.value?.substate as any)?.type) || "copying-instances";
});

const phaseIndex = computed(() => {
  const phases = [
    "copying-instances",
    "copying-settings",
    "copying-screenshots",
    "creating-archive",
    "finalizing",
  ];
  return phases.indexOf(phase.value);
});

const isFinalizing = computed(() => {
  return phase.value === "finalizing";
});

const copiedFiles = computed(() => {
  return (currentTask.value?.substate as any)?.copiedFiles || 0;
});

const totalFiles = computed(() => {
  return (currentTask.value?.substate as any)?.totalFiles || 0;
});

const backupLogs = computed(() => {
  return (currentTask.value?.substate as any)?.logs || [];
});

// Watch for task completion
watch(
  () => currentTask.value?.state,
  (newState) => {
    if (newState === TaskState.Succeed) {
      // Task completed successfully
      showCompleteDialog.value = true;
    } else if (newState === TaskState.Failed) {
      // Task failed, error will be shown
      creating.value = false;
    }
  }
);

function resetForm() {
  backupName.value = `backup-${new Date().toISOString().slice(0, 10)}`;
  includeInstances.value = true;
  includeSettings.value = true;
  includeScreenshots.value = false;
  error.value = "";
  creating.value = false;
  showCancelDialog.value = false;
  showCompleteDialog.value = false;
  selectedInstances.value = instances.value.map((i) => i.path);
}

function handleCancel() {
  if (!creating.value) {
    cancel();
    return;
  }

  if (isFinalizing.value) {
    // Don't allow cancel during finalizing
    return;
  }

  showCancelDialog.value = true;
}

async function confirmCancel() {
  showCancelDialog.value = false;
  // The task will be cancelled and partial backup will be saved
  if (currentTask.value) {
    const taskManager = (window as any).taskMonitor;
    await taskManager.cancel(currentTask.value.id);
  }
}

async function onCreateBackup() {
  if (!valid.value) return;

  try {
    creating.value = true;
    error.value = "";

    const fileName = backupName.value.endsWith(".xmclsettings")
      ? backupName.value
      : `${backupName.value}.xmclsettings`;

    const { filePath, canceled } = await showSaveDialog({
      title: t("setting.saveBackupFile"),
      defaultPath: fileName,
      filters: [{ name: "XMCL Backup", extensions: ["xmclsettings"] }],
    });

    if (canceled || !filePath) {
      //      error.value = t("setting.backupCancelled");
      // РўСѓС‚ СЏ РїСЂРѕСЃС‚Рѕ Р·Р°Р»РёС€Р°СЋ РєРѕРјРµРЅС‚ С‚Р°РєРёР№ С†С–РєР°РІРёР№
      creating.value = false;
      return;
    }

    await backupService.createBackup({
      destinationPath: filePath,
      includeInstances: includeInstances.value,
      selectedInstances: includeInstances.value ? selectedInstances.value : [],
      includeSettings: includeSettings.value,
      includeScreenshots: includeScreenshots.value,
    });

    // We don't call cancel() here because we want to wait for the task to complete
    // and show the success dialog.
  } catch (e: any) {
    if (e.message === "Backup cancelled by user") {
      // User cancelled, partial backup may have been saved
      error.value = t("setting.backupCancelled");
    } else {
      error.value = e.message || t("setting.backupFailed");
    }
    creating.value = false;
  }
}
</script>

<style scoped>
@keyframes pulse {
  0%,
  100% {
    opacity: 1;
    transform: scale(1);
  }
  50% {
    opacity: 0.6;
    transform: scale(1.1);
  }
}

@keyframes spin {
  from {
    transform: rotate(0deg);
  }
  to {
    transform: rotate(360deg);
  }
}

.pulse-icon {
  animation: pulse 1.5s ease-in-out infinite;
}

.finalizing-icon {
  animation: spin 1s linear infinite;
}
</style>

