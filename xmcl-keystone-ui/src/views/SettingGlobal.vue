<!-- src/components/SettingGlobal.vue -->
<template>
  <div>
    <SettingHeader>
      <div class="flex flex-col">
        🌍 {{ t('setting.globalSetting') }}
        <v-subheader class="my-0 h-[unset] px-0">
          {{ t('setting.globalSettingHint') }}
        </v-subheader>
      </div>
    </SettingHeader>

    <!-- Compact container for all global settings -->
    <div class="global-settings-container">
      <!-- Instance Launch Options -->
      <SettingGlobalLaunch />

      <!-- Advanced / Dangerous Actions -->
      <SettingGlobalAdvanced />
    </div>
  </div>
</template>

<script setup lang="ts">
import { useI18n } from 'vue-i18n-bridge'
import SettingHeader from '@/components/SettingHeader.vue'
import SettingGlobalLaunch from './SettingGlobalLaunch.vue'
import SettingGlobalAdvanced from './SettingGlobalAdvanced.vue'

const { t } = useI18n()
</script>

<style scoped>
.global-settings-container {
  /* Remove excessive spacing between sections */
  display: flex;
  flex-direction: column;
  gap: 0;
}

/* Ensure child components don't add extra top margin */
.global-settings-container :deep(> div:first-child) {
  margin-top: 0 !important;
}
</style>
