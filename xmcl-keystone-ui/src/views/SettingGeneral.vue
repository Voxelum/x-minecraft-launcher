<template>
  <SettingCard>
    <!-- Language Selection -->
    <SettingItem :description="t('setting.languageDescription')">
      <template #title>
        <v-icon left small color="primary">language</v-icon>
        {{ t("setting.language") }}
      </template>
      <template #action>
        <v-select
          v-model="selectedLocale"
          :items="locales"
          outlined
          dense
          hide-details
          class="language-select"
        >
          <template #selection="{ item }">
            <span class="font-weight-medium">{{ item.text }}</span>
          </template>
        </v-select>
      </template>
    </SettingItem>

    <v-divider class="my-3" />

    <!-- Data Directory -->
    <SettingItem
      :description="errorText || root"
      :title-class="`${errorText ? 'error--text' : ''}`"
      long-action
    >
      <template #title>
        <v-icon left small :color="errorText ? 'error' : 'primary'"
          >folder</v-icon
        >
        {{ t("setting.location") }}
      </template>
      <template #action>
        <div class="flex gap-2 justify-end">
          <v-btn small outlined color="primary" @click="onMigrateFromOther">
            <v-icon left small>local_shipping</v-icon>
            {{ t("setting.migrateFromOther") }}
          </v-btn>
          <v-btn small outlined color="primary" @click="browseRootDir">
            <v-icon left small>edit</v-icon>
            {{ t("setting.browseRoot") }}
          </v-btn>
          <v-btn small outlined color="primary" @click="showGameDirectory()">
            <v-icon left small>folder_open</v-icon>
            {{ t("setting.showRoot") }}
          </v-btn>
        </div>
      </template>
    </SettingItem>

    <v-divider class="my-3" />

    <!-- Backup & Restore -->
    <SettingItem :description="t('setting.backupDescription')">
      <template #title>
        <v-icon left small color="primary">backup</v-icon>
        {{ t("setting.backup") }}
      </template>
      <template #action>
        <div class="flex gap-2 justify-end">
          <v-btn small outlined color="primary" @click="createBackup">
            <v-icon left small>backup</v-icon>
            {{ t("setting.createBackup") }}
          </v-btn>
          <v-btn small outlined color="primary" @click="restoreBackup">
            <v-icon left small>restore</v-icon>
            {{ t("setting.restoreBackup") }}
          </v-btn>
        </div>
      </template>
    </SettingItem>

    <v-divider class="my-3" />

    <!-- Privacy & Telemetry -->
    <SettingItemSwitcher
      :value="disableTelemetry"
      @input="disableTelemetry = $event"
      :title="t('setting.disableTelemetry')"
      :description="t('setting.disableTelemetryDescription')"
      icon="privacy_tip"
    />

    <!-- GPU Optimization (Windows/Linux only) -->
    <template v-if="env?.os === 'linux' || env?.os === 'windows'">
      <v-divider class="my-3" />
      <SettingItemSwitcher
        :value="enableDedicatedGPUOptimization"
        @input="enableDedicatedGPUOptimization = $event"
        :title="t('setting.enableDedicatedGPUOptimization')"
        :description="t('setting.enableDedicatedGPUOptimizationDescription')"
        icon="memory"
      />
    </template>

    <!-- Discord Presence -->
    <v-divider class="my-3" />
    <SettingItemSwitcher
      :value="enableDiscord"
      @input="enableDiscord = $event"
      :title="t('setting.enableDiscord')"
      :description="t('setting.enableDiscordDescription')"
      icon="discord"
    />

    <!-- Developer Mode -->
    <v-divider class="my-3" />
    <SettingItemSwitcher
      :value="developerMode"
      @input="developerMode = $event"
      :title="t('setting.developerMode')"
      :description="t('setting.developerModeDescription')"
      icon="code"
    >
      <v-chip v-if="developerMode" x-small color="warning" class="ml-2">{{
        t("setting.devModeLabel")
      }}</v-chip>
    </SettingItemSwitcher>

    <!-- Streamer Mode -->
    <v-divider class="my-3" />
    <SettingItemSwitcher
      :value="streamerMode"
      @input="streamerMode = $event"
      :title="t('setting.streamerMode')"
      :description="t('setting.streamerModeDescription')"
      icon="videocam"
    />

    <!-- Spotlight Shortcut -->
    <v-divider class="my-3" />
    <SettingItem :description="t('setting.spotlightShortcutDescription')">
      <template #title>
        <v-icon left small color="primary">keyboard</v-icon>
        {{ t("setting.spotlightShortcut") }}
      </template>
      <template #action>
        <div class="shortcut-controls">
          <div class="shortcut-key-display">
            <div class="key-badge" :class="{ recording: isRecordingShortcut }">
              <v-icon
                size="18"
                :color="isRecordingShortcut ? 'warning' : 'primary'"
              >
                {{ isRecordingShortcut ? "mdi-timer-sand" : "mdi-keyboard" }}
              </v-icon>
              <span class="key-text">{{ shortcutDisplay }}</span>
            </div>
          </div>
          <div class="shortcut-buttons">
            <v-btn
              small
              :color="isRecordingShortcut ? 'warning' : 'primary'"
              variant="flat"
              @click="changeShortcut"
              :loading="isRecordingShortcut"
              class="change-btn"
              prepend-icon="mdi-pencil"
            >
              {{
                isRecordingShortcut
                  ? t("setting.recordingShortcut")
                  : t("setting.changeShortcut")
              }}
            </v-btn>
            <v-btn
              small
              variant="flat"
              color="grey-darken-1"
              @click="resetShortcut"
              class="reset-btn"
              prepend-icon="mdi-refresh"
            >
              {{ t("setting.resetShortcut") }}
            </v-btn>
          </div>
        </div>
      </template>
    </SettingItem>

    <v-divider class="my-3" />

    <SettingItem :description="t('setting.replaceNativeDescription')">
      <template #title>
        <v-icon left small color="primary">swap_horiz</v-icon>
        {{ t("setting.replaceNative") }}
      </template>
      <template #action>
        <v-select
          :value="replaceNative === false ? '' : replaceNative"
          :items="replaceNativeItems"
          outlined
          dense
          hide-details
          class="native-select"
          @change="replaceNative = !$event ? false : $event"
        />
      </template>
    </SettingItem>
  </SettingCard>
</template>

<script lang="ts" setup>
import SettingCard from "@/components/SettingCard.vue";
import SettingItem from "@/components/SettingItem.vue";
import { kCriticalStatus } from "@/composables/criticalStatus";
import { useGetDataDirErrorText } from "@/composables/dataRootErrors";
import { kEnvironment } from "@/composables/environment";
import { injection } from "@/util/inject";
import { useDialog } from "../composables/dialog";
import { useGameDirectory, useSettings } from "../composables/setting";
import SettingItemSwitcher from "@/components/SettingItemSwitcher.vue";
import { useLocalStorage } from "@vueuse/core";

const { isNoEmptySpace, invalidGameDataPath } = injection(kCriticalStatus);
const getDirErroText = useGetDataDirErrorText();
const errorText = computed(() =>
  isNoEmptySpace.value
    ? t("errors.DiskIsFull")
    : invalidGameDataPath.value
    ? getDirErroText(invalidGameDataPath.value)
    : undefined
);
const env = injection(kEnvironment);
const {
  streamerMode,
  developerMode,
  selectedLocale,
  replaceNative,
  disableTelemetry,
  enableDiscord,
  locales: rawLocales,
  enableDedicatedGPUOptimization,
} = useSettings();
const { t } = useI18n();
const locales = computed(() =>
  rawLocales.value.map(({ locale, name }) => ({ text: name, value: locale }))
);
const replaceNativeItems = computed(() => [
  {
    text: t("shared.disable"),
    value: "",
  },
  {
    text: t("setting.replaceNatives.legacy"),
    value: "legacy-only",
  },
  {
    text: t("setting.replaceNatives.all"),
    value: "all",
  },
]);

// Spotlight shortcut settings
const spotlightShortcut = useLocalStorage("spotlight-shortcut", "Ctrl+K");
const isRecordingShortcut = ref(false);

const shortcutDisplay = computed(() => {
  return spotlightShortcut.value;
});

function changeShortcut() {
  isRecordingShortcut.value = true;
  let currentKeys = new Set<string>();

  const handler = (e: KeyboardEvent) => {
    e.preventDefault();
    e.stopPropagation();

    // Track all pressed keys
    if (e.ctrlKey) currentKeys.add("Ctrl");
    if (e.metaKey) currentKeys.add("Cmd");
    if (e.altKey) currentKeys.add("Alt");
    if (e.shiftKey) currentKeys.add("Shift");

    // Add the main key (non-modifier)
    if (
      e.key !== "Control" &&
      e.key !== "Meta" &&
      e.key !== "Alt" &&
      e.key !== "Shift"
    ) {
      currentKeys.add(e.key.toUpperCase());
    }

    // Wait for key release to confirm
    const keyupHandler = (upEvent: KeyboardEvent) => {
      document.removeEventListener("keyup", keyupHandler);

      // Build the shortcut string
      const keys = Array.from(currentKeys);
      const modifiers: string[] = [];
      let mainKey = "";

      // Separate modifiers from main key
      for (const key of keys) {
        if (
          ["CTRL", "CMD", "META", "ALT", "SHIFT"].includes(key.toUpperCase())
        ) {
          modifiers.push(
            key === "CMD"
              ? "Cmd"
              : key.charAt(0).toUpperCase() + key.slice(1).toLowerCase()
          );
        } else {
          mainKey = key;
        }
      }

      // Must have at least one modifier and one main key
      if (modifiers.length > 0 && mainKey) {
        spotlightShortcut.value = [...modifiers, mainKey].join("+");
      }

      currentKeys.clear();
      isRecordingShortcut.value = false;
      document.removeEventListener("keydown", handler);
    };

    document.addEventListener("keyup", keyupHandler, { once: true });
  };

  document.addEventListener("keydown", handler, { once: false });
}

function resetShortcut() {
  spotlightShortcut.value = "Ctrl+K";
}

const { show } = useDialog("migration");
const { root, showGameDirectory } = useGameDirectory();
async function browseRootDir() {
  show();
}

const { show: onMigrateFromOther } = useDialog("migrate-wizard");

// Backup & Restore
const { show: showBackupDialog } = useDialog("backup");
const { show: showRestoreDialog } = useDialog("restore");

async function createBackup() {
  showBackupDialog({});
}

async function restoreBackup() {
  showRestoreDialog({});
}
</script>

<style scoped>
.settings-card {
  border-radius: 12px;
}

:deep(.transparent-list) {
  background: transparent !important;
}

.language-select,
.native-select {
  min-width: 200px;
  max-width: 300px;
}

.v-list-item {
  min-height: 64px;
}

.v-list-item__action {
  align-self: center;
}

/* Spotlight Shortcut Controls */
.shortcut-controls {
  display: flex;
  align-items: center;
  gap: 16px;
  flex-wrap: wrap;
}

.shortcut-key-display {
  flex-shrink: 0;
}

.key-badge {
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 8px 16px;
  background: linear-gradient(
    135deg,
    rgba(var(--v-primary-base), 0.15) 0%,
    rgba(var(--v-primary-base), 0.08) 100%
  );
  border: 1.5px solid rgba(var(--v-primary-base), 0.3);
  border-radius: 10px;
  transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1);
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.1),
    inset 0 1px 0 rgba(255, 255, 255, 0.05);
}

.key-badge.recording {
  background: linear-gradient(
    135deg,
    rgba(255, 152, 0, 0.15) 0%,
    rgba(255, 152, 0, 0.08) 100%
  );
  border-color: rgba(255, 152, 0, 0.4);
  animation: pulse-glow 2s ease-in-out infinite;
}

@keyframes pulse-glow {
  0%,
  100% {
    box-shadow: 0 2px 8px rgba(255, 152, 0, 0.2),
      inset 0 1px 0 rgba(255, 255, 255, 0.05);
  }
  50% {
    box-shadow: 0 4px 16px rgba(255, 152, 0, 0.4),
      inset 0 1px 0 rgba(255, 255, 255, 0.1);
  }
}

.key-text {
  font-family: "JetBrains Mono", "Fira Code", "Consolas", monospace;
  font-size: 14px;
  font-weight: 600;
  color: var(--v-primary-base);
  letter-spacing: 0.5px;
}

.key-badge.recording .key-text {
  color: #ff9800;
}

.shortcut-buttons {
  display: flex;
  align-items: center;
  gap: 8px;
}

.change-btn {
  border-radius: 8px !important;
  transition: all 0.2s cubic-bezier(0.4, 0, 0.2, 1);
  font-weight: 500;
  text-transform: none;
  letter-spacing: 0.3px;
}

.change-btn:hover {
  transform: translateY(-1px);
  box-shadow: 0 4px 12px rgba(var(--v-primary-base), 0.3);
}

.reset-btn {
  border-radius: 8px !important;
  transition: all 0.2s cubic-bezier(0.4, 0, 0.2, 1);
  font-weight: 500;
  text-transform: none;
  letter-spacing: 0.3px;
  opacity: 0.7;
}

.reset-btn:hover {
  opacity: 1;
  background: rgba(255, 255, 255, 0.08) !important;
}

@media (max-width: 600px) {
  .shortcut-controls {
    flex-direction: column;
    align-items: flex-start;
    gap: 12px;
  }

  .shortcut-buttons {
    width: 100%;
  }

  .change-btn,
  .reset-btn {
    flex: 1;
  }
}
</style>
