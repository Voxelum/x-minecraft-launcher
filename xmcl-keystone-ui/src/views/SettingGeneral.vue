<template>
  <div class="settings-page">
    <SettingHeader>
      ⚙️ {{ t("setting.general") }}
    </SettingHeader>

    <div class="content-grid">
      <!-- Language Settings -->
      <div class="settings-card">
        <h3 class="card-title">
          <v-icon class="title-icon">language</v-icon>
          {{ t('setting.languageSettings') }}
        </h3>
        <div class="settings-list">
          <SettingItemSelect :select.sync="selectedLocale" :title="t('setting.language')" :text="t('setting.language')"
            :description="t('setting.languageDescription')" :items="locales" />
        </div>
      </div>

      <!-- Game Directory Settings -->
      <div class="settings-card full-width">
        <h3 class="card-title">
          <v-icon class="title-icon">folder</v-icon>
          {{ t('setting.gameDirectory') }}
        </h3>
        <div class="directory-control">
          <div class="path-display">
            <div class="path-label">{{ t("setting.location") }}</div>
            <div class="path-value" :class="{ 'error-path': errorText }">
              <v-icon v-if="errorText" color="error" class="mr-2">error</v-icon>
              {{ errorText || root }}
            </div>
          </div>
          <div class="action-buttons">
            <v-btn text color="primary" @click="onMigrateFromOther">
              <v-icon left>local_shipping</v-icon>
              {{ t("setting.migrateFromOther") }}
            </v-btn>
            <v-btn text color="primary" @click="browseRootDir">
              <v-icon left>edit</v-icon>
              {{ t("setting.browseRoot") }}
            </v-btn>
            <v-btn text color="primary" @click="showGameDirectory()">
              <v-icon left>folder</v-icon>
              {{ t("setting.showRoot") }}
            </v-btn>
          </div>
        </div>
      </div>

      <!-- Application Settings -->
      <div class="settings-card">
        <h3 class="card-title">
          <v-icon class="title-icon">apps</v-icon>
          {{ t('setting.applicationSettings') }}
        </h3>
        <div class="settings-list">
          <SettingItemCheckbox v-model="disableTelemetry" :title="t('setting.disableTelemetry')"
            :text="t('setting.disableTelemetry')" :description="t('setting.disableTelemetryDescription')" />
          <SettingItemCheckbox v-if="env?.os === 'linux' || env?.os === 'windows'"
            v-model="enableDedicatedGPUOptimization" :title="t('setting.enableDedicatedGPUOptimization')"
            :text="t('setting.enableDedicatedGPUOptimization')"
            :description="t('setting.enableDedicatedGPUOptimizationDescription')" />
          <SettingItemCheckbox v-model="enableDiscord" :title="t('setting.enableDiscord')"
            :text="t('setting.enableDiscord')" :description="t('setting.enableDiscordDescription')" />
        </div>
      </div>

      <!-- Advanced Settings -->
      <div class="settings-card">
        <h3 class="card-title">
          <v-icon class="title-icon">tune</v-icon>
          {{ t('setting.advancedSettings') }}
        </h3>
        <div class="settings-list">
          <SettingItemCheckbox v-model="developerMode" :title="t('setting.developerMode')"
            :text="t('setting.developerMode')" :description="t('setting.developerModeDescription')" />
          <SettingItemCheckbox v-model="streamerMode" :title="t('setting.streamerMode')"
            :text="t('setting.streamerMode')" :description="t('setting.streamerModeDescription')" />
          <SettingItemSelect :select="replaceNative === false ? '' : replaceNative" :title="t('setting.replaceNative')"
            :text="t('setting.replaceNative')" :description="t('setting.replaceNativeDescription')"
            :items="replaceNativeItems" @update:select="replaceNative = !$event ? false : $event" />
        </div>
      </div>
    </div>
  </div>
</template>

<script lang="ts" setup>
import SettingHeader from '@/components/SettingHeader.vue'
import SettingItemCheckbox from '@/components/SettingItemCheckbox.vue'
import SettingItemSelect from '@/components/SettingItemSelect.vue'
import { kEnvironment } from '@/composables/environment'
import { injection } from '@/util/inject'
import { useDialog } from '../composables/dialog'
import { useGameDirectory, useSettings } from '../composables/setting'
import { kCriticalStatus } from '@/composables/criticalStatus'
import { useGetDataDirErrorText } from '@/composables/dataRootErrors'

const { isNoEmptySpace, invalidGameDataPath } = injection(kCriticalStatus)
const getDirErroText = useGetDataDirErrorText()
const errorText = computed(() => isNoEmptySpace.value ? t('errors.DiskIsFull') : invalidGameDataPath.value ? getDirErroText(invalidGameDataPath.value) : undefined)
const env = injection(kEnvironment)
const {
  streamerMode,
  developerMode,
  selectedLocale,
  replaceNative,
  disableTelemetry,
  enableDiscord,
  locales: rawLocales,
  enableDedicatedGPUOptimization,
} = useSettings()
const { t } = useI18n()
const locales = computed(() => rawLocales.value.map(({ locale, name }) => ({ text: name, value: locale })))
const replaceNativeItems = computed(() => [
  { text: t('disable'), value: '' },
  { text: t('setting.replaceNatives.legacy'), value: 'legacy-only' },
  { text: t('setting.replaceNatives.all'), value: 'all' },
])

const { show } = useDialog('migration')
const { root, showGameDirectory } = useGameDirectory()
async function browseRootDir() {
  show()
}

const { show: onMigrateFromOther } = useDialog('migrate-wizard')
</script>

<style scoped>
.settings-page {
  padding: 16px;
  max-width: 1200px;
  margin: 0 auto;
}

.content-grid {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(400px, 1fr));
  gap: 24px;
}

.settings-card {
  background-color: rgba(255, 255, 255, 0.04);
  border: 1px solid rgba(255, 255, 255, 0.08);
  border-radius: 12px;
  padding: 20px;
  transition: box-shadow 0.3s ease, transform 0.3s ease;
}

.settings-card:hover {
  box-shadow: 0 4px 20px rgba(0, 0, 0, 0.2);
  transform: translateY(-2px);
}

.settings-card.full-width {
  grid-column: 1 / -1;
}

.card-title {
  font-size: 1.1rem;
  font-weight: 600;
  color: rgba(255, 255, 255, 0.95);
  margin-bottom: 20px;
  display: flex;
  align-items: center;
  gap: 12px;
  padding-bottom: 12px;
  border-bottom: 1px solid rgba(255, 255, 255, 0.1);
}

.title-icon {
  color: var(--v-primary-base);
  font-size: 1.3rem;
}

.settings-list {
  display: flex;
  flex-direction: column;
  gap: 16px;
}

.directory-control {
  display: flex;
  flex-direction: column;
  gap: 20px;
}

.path-display {
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.path-label {
  font-weight: 500;
  color: rgba(255, 255, 255, 0.85);
  font-size: 0.9rem;
}

.path-value {
  padding: 12px 16px;
  background: rgba(255, 255, 255, 0.06);
  border-radius: 8px;
  color: rgba(255, 255, 255, 0.8);
  word-break: break-all;
  line-height: 1.5;
  border: 1px solid rgba(255, 255, 255, 0.1);
  font-family: monospace;
}

.error-path {
  color: #ff7878;
  background: rgba(255, 82, 82, 0.1);
  border-color: rgba(255, 82, 82, 0.3);
}

.action-buttons {
  display: flex;
  flex-wrap: wrap;
  gap: 12px;
}

:deep(.v-list-item) {
  background-color: rgba(255, 255, 255, 0.03);
  border-radius: 8px;
  margin-bottom: 0;
  transition: background-color 0.2s ease;
}

:deep(.v-list-item:hover) {
  background-color: rgba(255, 255, 255, 0.06);
}

:deep(.v-list-item__title) {
  color: rgba(255, 255, 255, 0.95) !important;
  font-size: 0.95rem !important;
}

:deep(.v-list-item__subtitle) {
  color: rgba(255, 255, 255, 0.6) !important;
  font-size: 0.85rem !important;
  white-space: normal !important;
  line-height: 1.4 !important;
}
</style>
