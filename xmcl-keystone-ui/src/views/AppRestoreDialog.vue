<template>
  <div>
    <v-dialog
      v-model="isShown"
      hide-overlay
      transition="dialog-bottom-transition"
      scrollable
      width="500"
    >
      <v-card>
        <v-toolbar class="moveable flex-1 flex-grow-0 rounded-none" tabs>
          <v-toolbar-title class="text-white">
            {{ t("setting.restoreBackup") }}
          </v-toolbar-title>

          <v-spacer />
          <v-btn class="non-moveable" icon @click="cancel">
            <v-icon>arrow_drop_down</v-icon>
          </v-btn>
        </v-toolbar>

        <v-card-text class="pa-4">
          <v-file-input
            v-model="backupFile"
            :label="t('setting.selectBackupFile')"
            :hint="t('setting.selectBackupFileHint')"
            persistent-hint
            accept=".xmclsettings"
            prepend-icon="folder_open"
            show-size
            truncate-length="30"
          />

          <v-alert v-if="backupInfo" type="info" class="mt-3" dense>
            <div class="text-caption">
              <strong>{{ t("setting.backupInfo") }}:</strong>
            </div>
            <div>
              {{
                t("setting.backupInstances", {
                  count: backupInfo.instanceCount,
                })
              }}
            </div>
            <div>
              {{
                t("setting.backupCreated", {
                  date: new Date(backupInfo.createdAt).toLocaleString(),
                })
              }}
            </div>
            <div>
              {{
                t("setting.backupSize", { size: formatSize(backupInfo.size) })
              }}
            </div>
          </v-alert>

          <v-alert v-if="error" type="error" class="mt-3" dense>
            {{ error }}
          </v-alert>

          <v-alert v-if="showWarning" type="warning" class="mt-3" dense>
            {{ t("setting.restoreWarning") }}
          </v-alert>
        </v-card-text>

        <v-card-actions>
          <v-spacer />
          <v-btn text @click="cancel">
            {{ t("shared.cancel") }}
          </v-btn>
          <v-btn
            color="warning"
            :loading="restoring"
            :disabled="!backupFile || restoring"
            @click="onRestoreBackup"
          >
            <v-icon left>restore</v-icon>
            {{ t("setting.restoreBackup") }}
          </v-btn>
        </v-card-actions>
      </v-card>
    </v-dialog>

    <!-- Restart Confirmation Dialog -->
    <v-dialog v-model="showRestartDialog" max-width="400" persistent>
      <v-card>
        <v-card-title class="headline">
          {{ t("setting.restoreComplete") }}
        </v-card-title>
        <v-card-text>
          <p>{{ t("setting.restoreCompleteMessage") }}</p>
          <p class="mt-2 text-caption grey--text">
            {{ t("setting.restoreRestartHint") }}
          </p>
        </v-card-text>
        <v-card-actions>
          <v-spacer />
          <v-btn
            text
            @click="
              showRestartDialog = false;
              cancel();
            "
          >
            {{ t("shared.later") }}
          </v-btn>
          <v-btn color="primary" @click="restartLauncher">
            {{ t("shared.restart") }}
          </v-btn>
        </v-card-actions>
      </v-card>
    </v-dialog>
  </div>
</template>

<script lang="ts" setup>
import { useDialog } from "@/composables/dialog";
import { useService } from "@/composables";
import { BackupServiceKey, BaseServiceKey } from "@xmcl/runtime-api";
import { ref, watch } from "vue";
import { useI18n } from "vue-i18n-bridge";

const { t } = useI18n();
const { isShown, hide: cancel } = useDialog("restore", () => {
  resetForm();
});

const backupService = useService(BackupServiceKey);
const baseService = useService(BaseServiceKey);

const backupFile = ref<File | null>(null);
const restoring = ref(false);
const error = ref("");
const showWarning = ref(false);
const showRestartDialog = ref(false);
const backupInfo = ref<{
  instanceCount: number;
  createdAt: number;
  size: number;
} | null>(null);

watch(backupFile, async (file) => {
  if (file) {
    try {
      backupInfo.value = await backupService.getBackupInfo(file.path);
      showWarning.value = true;
    } catch {
      backupInfo.value = null;
      showWarning.value = false;
    }
  } else {
    backupInfo.value = null;
    showWarning.value = false;
  }
});

function resetForm() {
  backupFile.value = null;
  error.value = "";
  restoring.value = false;
  showWarning.value = false;
  showRestartDialog.value = false;
  backupInfo.value = null;
}

function formatSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(2)} KB`;
  if (bytes < 1024 * 1024 * 1024)
    return `${(bytes / 1024 / 1024).toFixed(2)} MB`;
  return `${(bytes / 1024 / 1024 / 1024).toFixed(2)} GB`;
}

async function onRestoreBackup() {
  if (!backupFile.value) return;

  try {
    restoring.value = true;
    error.value = "";

    const dataRoot = await baseService.getGameDataDirectory();

    await backupService.restoreBackup({
      backupPath: backupFile.value.path,
      destinationPath: dataRoot,
    });

    // Show restart prompt
    showRestartDialog.value = true;
  } catch (e: any) {
    error.value = e.message || t("setting.restoreFailed");
  } finally {
    restoring.value = false;
  }
}

function restartLauncher() {
  showRestartDialog.value = false;
  baseService.quitAndInstall();
}
</script>
