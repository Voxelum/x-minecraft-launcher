<template>
  <div>
    <SettingHeader>
      {{ t("setting.general") }}
    </SettingHeader>
    <SettingItemSelect
      :select.sync="selectedLocale"
      :title="t('setting.language')"
      :description="t('setting.languageDescription')"
      :items="locales"
    />
    <v-list-item>
      <v-list-item-content>
        <v-list-item-title :color="errorText ? 'red' : ''">{{ t("setting.location") }}</v-list-item-title>
        <v-list-item-subtitle :class="errorText ? 'text-red' : ''">{{ locationSubtitle }}</v-list-item-subtitle>
      </v-list-item-content>
      <v-list-item-action>
          <v-btn
            outlined
            text
            @click="onMigrateFromOther"
          >
            {{ t("setting.migrateFromOther") }}
          </v-btn>
        </v-list-item-action>
        <v-list-item-action>
          <v-btn
            outlined
            text
            @click="browseRootDir"
          >
            {{ t("setting.browseRoot") }}
          </v-btn>
        </v-list-item-action>
        <v-list-item-action>
          <v-btn
            outlined
            text
            @click="showGameDirectory()"
          >
            {{ t("setting.showRoot") }}
          </v-btn>
        </v-list-item-action>
    </v-list-item>
    <SettingItemCheckbox
      v-model="disableTelemetry"
      :title="t('setting.disableTelemetry')"
      :description="t('setting.disableTelemetryDescription')"
    />
    <SettingItemCheckbox
      v-model="enableDedicatedGPUOptimization"
      :title="t('setting.enableDedicatedGPUOptimization')"
      :description="t('setting.enableDedicatedGPUOptimizationDescription')"
    />
    <SettingItemCheckbox
      v-model="enableDiscord"
      :title="t('setting.enableDiscord')"
      :description="t('setting.enableDiscordDescription')"
    />
    <SettingItemCheckbox
      v-model="developerMode"
      :title="t('setting.developerMode')"
      :description="t('setting.developerModeDescription')"
    />
    <SettingItemCheckbox
      v-model="streamerMode"
      :title="t('setting.streamerMode')"
      :description="t('setting.streamerModeDescription')"
    />
    <SettingItemSelect
      :select="replaceNativeSelect"
      :title="t('setting.replaceNative')"
      :description="t('setting.replaceNativeDescription')"
      :items="replaceNativeItems"
      @update:select="onUpdateReplaceNative"
    />
    <SettingItemSelect
      :select="sidebarPosition"
      :title="t('setting.sidebarPosition.name')"
      :description="t('setting.sidebarPosition.description')"
      :items="sidebarPositionItems"
      @update:select="sidebarPosition = $event"
    />
  </div>
</template>
<script lang="ts">
import { defineComponent, computed } from 'vue';
import SettingHeader from '@/components/SettingHeader.vue';
import SettingItemCheckbox from '@/components/SettingItemCheckbox.vue';
import SettingItemSelect from '@/components/SettingItemSelect.vue';
import { kEnvironment } from '@/composables/environment';
import { injection } from '@/util/inject';
import { useDialog } from '../composables/dialog';
import { useGameDirectory, useSettings } from '../composables/setting';
import { kCriticalStatus } from '@/composables/criticalStatus';
import { useGetDataDirErrorText } from '@/composables/dataRootErrors';
import { getCurrentInstance } from 'vue';

export default defineComponent({
  components: { SettingHeader, SettingItemCheckbox, SettingItemSelect },
  setup() {
    const instance = getCurrentInstance();
    const t = instance.$t;
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
    function onUpdateReplaceNative(event) {
      replaceNative.value = !event ? false : event;
    }

    const { show } = useDialog('migration');
    const { root, showGameDirectory } = useGameDirectory();
    async function browseRootDir() {
      show();
    }
    const { show: onMigrateFromOther } = useDialog('migrate-wizard');

    return {
      errorText,
      env,
      streamerMode,
      developerMode,
      selectedLocale,
      replaceNative,
      disableTelemetry,
      enableDiscord,
      locales,
      enableDedicatedGPUOptimization,
      sidebarPosition,
      textColor,
      t,
      replaceNativeItems,
      sidebarPositionItems,
      root,
      showGameDirectory,
      browseRootDir,
      onMigrateFromOther
    };
  }
});
</script>
