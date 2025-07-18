<template>
  <div>
    <SettingHeader>
      {{ $t("setting.general") }}
    </SettingHeader>
    <SettingItemSelect
      :select.sync="selectedLocale"
      :title="String($t('setting.language'))"
      :description="String($t('setting.languageDescription'))"
      :items="locales"
    />
    <v-list-item>
      <v-list-item-content>
        <v-list-item-title :color="errorText ? 'red' : ''">{{ String($t("setting.location")) }}</v-list-item-title>
        <v-list-item-subtitle :class="errorText ? 'text-red' : ''">{{ locationSubtitle }}</v-list-item-subtitle>
      </v-list-item-content>
      <v-list-item-action>
          <v-btn
            outlined
            text
            @click="onMigrateFromOther"
          >
            {{ String($t("setting.migrateFromOther")) }}
          </v-btn>
        </v-list-item-action>
        <v-list-item-action>
          <v-btn
            outlined
            text
            @click="browseRootDir"
          >
            {{ String($t("setting.browseRoot")) }}
          </v-btn>
        </v-list-item-action>
        <v-list-item-action>
          <v-btn
            outlined
            text
            @click="showGameDirectory()"
          >
            {{ String($t("setting.showRoot")) }}
          </v-btn>
        </v-list-item-action>
    </v-list-item>
    <SettingItemCheckbox
      v-model="disableTelemetry"
      :title="String($t('setting.disableTelemetry'))"
      :description="String($t('setting.disableTelemetryDescription'))"
    />
    <SettingItemCheckbox
      v-model="enableDedicatedGPUOptimization"
      :title="String($t('setting.enableDedicatedGPUOptimization'))"
      :description="String($t('setting.enableDedicatedGPUOptimizationDescription'))"
    />
    <SettingItemCheckbox
      v-model="enableDiscord"
      :title="String($t('setting.enableDiscord'))"
      :description="String($t('setting.enableDiscordDescription'))"
    />
    <SettingItemCheckbox
      v-model="developerMode"
      :title="String($t('setting.developerMode'))"
      :description="String($t('setting.developerModeDescription'))"
    />
    <SettingItemCheckbox
      v-model="streamerMode"
      :title="String($t('setting.streamerMode'))"
      :description="String($t('setting.streamerModeDescription'))"
    />
    <SettingItemSelect
      :select="replaceNativeSelect"
      :title="String($t('setting.replaceNative'))"
      :description="String($t('setting.replaceNativeDescription'))"
      :items="replaceNativeItems"
      @update:select="onUpdateReplaceNative"
    />
    <SettingItemSelect
      :select="sidebarPosition"
      :title="String($t('setting.sidebarPosition.name'))"
      :description="String($t('setting.sidebarPosition.description'))"
      :items="sidebarPositionItems"
      @update:select="onUpdateSidebarPosition"
    />
  </div>
</template>
<script lang="ts" setup>
import { computed } from 'vue';
import { useI18n } from 'vue-i18n-bridge';
import SettingHeader from '@/components/SettingHeader.vue';
import SettingItemCheckbox from '@/components/SettingItemCheckbox.vue';
import SettingItemSelect from '@/components/SettingItemSelect.vue';
import { kEnvironment } from '@/composables/environment';
import { injection } from '@/util/inject';
import { useDialog } from '../composables/dialog';
import { useGameDirectory, useSettings } from '../composables/setting';
import { kCriticalStatus } from '@/composables/criticalStatus';
import { useGetDataDirErrorText } from '@/composables/dataRootErrors';
const { t } = useI18n();
const { isNoEmptySpace, invalidGameDataPath } = injection(kCriticalStatus);
const getDirErroText = useGetDataDirErrorText();
const errorText = computed(() => isNoEmptySpace.value ? t('errors.DiskIsFull') : invalidGameDataPath.value ? getDirErroText(invalidGameDataPath.value) : undefined);
const locationSubtitle = computed(() => errorText.value ?? root.value);
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
  sidebarPosition,
  textColor,
} = useSettings();
const locales = computed(() => rawLocales.value.map(({ locale, name }) => ({ text: name, value: locale })));
const replaceNativeItems = computed(() => [{ text: t('disable'), value: '' }, { text: t('setting.replaceNatives.legacy'), value: 'legacy-only' }, { text: t('setting.replaceNatives.all'), value: 'all' }]);
const sidebarPositionItems = computed(() => [{ text: t('setting.sidebarPosition.left'), value: 'left' }, { text: t('setting.sidebarPosition.right'), value: 'right' }]);
const replaceNativeSelect = computed(() => replaceNative.value === false ? '' : replaceNative.value);
function onUpdateReplaceNative(event: string) {
  replaceNative.value = !event ? false : event;
}
function onUpdateSidebarPosition(event: string) {
  sidebarPosition.value = event as 'left' | 'right';
}
const { show } = useDialog('migration');
const { root, showGameDirectory } = useGameDirectory();
async function browseRootDir() {
  show();
}
const { show: onMigrateFromOther } = useDialog('migrate-wizard');
</script>
const sidebarPositionItems = computed(() => [{ text: t('setting.sidebarPosition.left'), value: 'left' }, { text: t('setting.sidebarPosition.right'), value: 'right' }]);
const replaceNativeSelect = computed(() => replaceNative.value === false ? '' : replaceNative.value);
function onUpdateReplaceNative(event: string) {
  replaceNative.value = !event ? false : event;
}
function onUpdateSidebarPosition(event: string) {
  sidebarPosition.value = event as 'left' | 'right';
}
const { show } = useDialog('migration');
const { root, showGameDirectory } = useGameDirectory();
async function browseRootDir() {
  show();
}
const { show: onMigrateFromOther } = useDialog('migrate-wizard');
</script>
