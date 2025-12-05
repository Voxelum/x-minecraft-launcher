<template>
  <div>
    <!-- General Settings Card -->
    <v-card class="mb-6 mt-4" elevation="0" color="transparent" flat>
      <v-card-title class="text-h6 pb-2 px-0">
        <v-icon left color="primary">settings</v-icon>
        {{ t("setting.general") }}
      </v-card-title>
      <v-card-text class="px-0">
        <v-card class="settings-card" elevation="2">
          <v-card-text class="pa-4">
            <v-list class="transparent-list">
              <!-- Language Selection -->
              <v-list-item>
                <v-list-item-content>
                  <v-list-item-title class="font-weight-medium">
                    <v-icon left small color="primary">language</v-icon>
                    {{ t('setting.language') }}
                  </v-list-item-title>
                  <v-list-item-subtitle>
                    {{ t('setting.languageDescription') }}
                  </v-list-item-subtitle>
                </v-list-item-content>
                <v-list-item-action class="ml-4">
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
                </v-list-item-action>
              </v-list-item>

              <v-divider class="my-3" />

              <!-- Data Directory -->
              <v-list-item>
                <v-list-item-content>
                  <v-list-item-title class="font-weight-medium" :class="{ 'error--text': errorText }">
                    <v-icon left small :color="errorText ? 'error' : 'primary'">folder</v-icon>
                    {{ t("setting.location") }}
                  </v-list-item-title>
                  <v-list-item-subtitle v-if="errorText" class="error--text">
                    {{ errorText }}
                  </v-list-item-subtitle>
                  <v-list-item-subtitle v-else class="text-truncate" style="max-width: 400px">
                    {{ root }}
                  </v-list-item-subtitle>
                </v-list-item-content>
                <v-list-item-action class="flex-row gap-2">
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
                </v-list-item-action>
              </v-list-item>

              <v-divider class="my-3" />

              <!-- Privacy & Telemetry -->
              <v-list-item>
                <v-list-item-content>
                  <v-list-item-title class="font-weight-medium">
                    <v-icon left small color="primary">privacy_tip</v-icon>
                    {{ t('setting.disableTelemetry') }}
                  </v-list-item-title>
                  <v-list-item-subtitle>
                    {{ t('setting.disableTelemetryDescription') }}
                  </v-list-item-subtitle>
                </v-list-item-content>
                <v-list-item-action>
                  <v-switch v-model="disableTelemetry" color="primary" hide-details />
                </v-list-item-action>
              </v-list-item>

              <!-- GPU Optimization (Windows/Linux only) -->
              <template v-if="env?.os === 'linux' || env?.os === 'windows'">
                <v-divider class="my-3" />
                <v-list-item>
                  <v-list-item-content>
                    <v-list-item-title class="font-weight-medium">
                      <v-icon left small color="primary">memory</v-icon>
                      {{ t('setting.enableDedicatedGPUOptimization') }}
                    </v-list-item-title>
                    <v-list-item-subtitle>
                      {{ t('setting.enableDedicatedGPUOptimizationDescription') }}
                    </v-list-item-subtitle>
                  </v-list-item-content>
                  <v-list-item-action>
                    <v-switch v-model="enableDedicatedGPUOptimization" color="primary" hide-details />
                  </v-list-item-action>
                </v-list-item>
              </template>

              <!-- Discord Presence -->
              <v-divider class="my-3" />
              <v-list-item>
                <v-list-item-content>
                  <v-list-item-title class="font-weight-medium">
                    <v-icon left small color="primary">discord</v-icon>
                    {{ t('setting.enableDiscord') }}
                  </v-list-item-title>
                  <v-list-item-subtitle>
                    {{ t('setting.enableDiscordDescription') }}
                  </v-list-item-subtitle>
                </v-list-item-content>
                <v-list-item-action>
                  <v-switch v-model="enableDiscord" color="primary" hide-details />
                </v-list-item-action>
              </v-list-item>

              <!-- Developer Mode -->
              <v-divider class="my-3" />
              <v-list-item>
                <v-list-item-content>
                  <v-list-item-title class="font-weight-medium">
                    <v-icon left small color="warning">code</v-icon>
                    {{ t('setting.developerMode') }}
                    <v-chip v-if="developerMode" x-small color="warning" class="ml-2">DEV</v-chip>
                  </v-list-item-title>
                  <v-list-item-subtitle>
                    {{ t('setting.developerModeDescription') }}
                  </v-list-item-subtitle>
                </v-list-item-content>
                <v-list-item-action>
                  <v-switch v-model="developerMode" color="warning" hide-details />
                </v-list-item-action>
              </v-list-item>

              <!-- Streamer Mode -->
              <v-divider class="my-3" />
              <v-list-item>
                <v-list-item-content>
                  <v-list-item-title class="font-weight-medium">
                    <v-icon left small color="primary">videocam</v-icon>
                    {{ t('setting.streamerMode') }}
                  </v-list-item-title>
                  <v-list-item-subtitle>
                    {{ t('setting.streamerModeDescription') }}
                  </v-list-item-subtitle>
                </v-list-item-content>
                <v-list-item-action>
                  <v-switch v-model="streamerMode" color="primary" hide-details />
                </v-list-item-action>
              </v-list-item>

              <!-- Replace Native Libraries -->
              <v-divider class="my-3" />
              <v-list-item>
                <v-list-item-content>
                  <v-list-item-title class="font-weight-medium">
                    <v-icon left small color="primary">swap_horiz</v-icon>
                    {{ t('setting.replaceNative') }}
                  </v-list-item-title>
                  <v-list-item-subtitle>
                    {{ t('setting.replaceNativeDescription') }}
                  </v-list-item-subtitle>
                </v-list-item-content>
                <v-list-item-action class="ml-4">
                  <v-select
                    :value="replaceNative === false ? '' : replaceNative"
                    :items="replaceNativeItems"
                    outlined
                    dense
                    hide-details
                    class="native-select"
                    @change="replaceNative = !$event ? false : $event"
                  />
                </v-list-item-action>
              </v-list-item>
            </v-list>
          </v-card-text>
        </v-card>
      </v-card-text>
    </v-card>
  </div>
</template>

<script lang="ts" setup>
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
  {
    text: t('disable'),
    value: '',
  },
  {
    text: t('setting.replaceNatives.legacy'),
    value: 'legacy-only',
  },
  {
    text: t('setting.replaceNatives.all'),
    value: 'all',
  },
])

const { show } = useDialog('migration')
const { root, showGameDirectory } = useGameDirectory()
async function browseRootDir() {
  show()
}

const { show: onMigrateFromOther } = useDialog('migrate-wizard')

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
</style>
