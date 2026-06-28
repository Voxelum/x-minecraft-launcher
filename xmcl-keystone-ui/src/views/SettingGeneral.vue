<template>
  <div class="flex flex-col gap-4">
    <SettingCard :title="t('setting.general')" icon="dns">
      <!-- Language Selection -->
      <SettingItemSelect
        v-model="selectedLocale"
        icon="language"
        :title="t('setting.language')"
        :description="t('setting.languageDescription')"
        :items="locales"
        :search-query="searchQuery"
      />

      <v-divider class="my-3 opacity-20" />

      <!-- Data Directory -->
      <SettingItem 
        :description="errorText || root" 
        :title-class="`${errorText ? 'error--text' : ''}`" 
        long-action
        :title="t('setting.location')"
        :search-query="searchQuery"
      >
        <template #title>
          <v-icon start size="small" :color="errorText ? 'error' : 'primary'">folder</v-icon>
          {{ t("setting.location") }}
        </template>
        <template #action>
          <div class="flex gap-2 justify-end">
            <v-btn color="primary" variant="outlined" @click="onMigrateFromOther">
              <v-icon start size="small">local_shipping</v-icon>
              {{ t("setting.migrateFromOther") }}
            </v-btn>
            <v-btn color="primary" variant="outlined" @click="browseRootDir">
              <v-icon start size="small">edit</v-icon>
              {{ t("setting.browseRoot") }}
            </v-btn>
            <v-btn color="primary" variant="outlined" @click="showGameDirectory()">
              <v-icon start size="small">folder_open</v-icon>
              {{ t("setting.showRoot") }}
            </v-btn>
          </div>
        </template>
      </SettingItem>

      <!-- GPU Optimization (Windows/Linux only) -->
      <template v-if="env?.os === 'linux' || env?.os === 'windows'">
        <v-divider class="my-3 opacity-20" />
        <SettingItemSwitcher
          v-model="enableDedicatedGPUOptimization"
          :title="t('setting.enableDedicatedGPUOptimization')"
          :description="t('setting.enableDedicatedGPUOptimizationDescription')"
          icon="memory"
          :search-query="searchQuery"
        />
      </template>
    </SettingCard>
  </div>
</template>

<script lang="ts" setup>
import { computed } from 'vue'
import { useI18n } from 'vue-i18n'
import SettingCard from '@/components/SettingCard.vue'
import SettingItem from '@/components/SettingItem.vue'
import SettingItemSelect from '@/components/SettingItemSelect.vue'
import SettingItemSwitcher from '@/components/SettingItemSwitcher.vue'
import { kCriticalStatus } from '@/composables/criticalStatus'
import { useGetDataDirErrorText } from '@/composables/dataRootErrors'
import { kEnvironment } from '@/composables/environment'
import { injection } from '@/util/inject'
import { useDialog } from '../composables/dialog'
import { useGameDirectory, useSettings } from '../composables/setting'

defineProps<{
  searchQuery?: string
}>()

const { isNoEmptySpace, invalidGameDataPath } = injection(kCriticalStatus)
const getDirErroText = useGetDataDirErrorText()
const errorText = computed(() => isNoEmptySpace.value ? t('errors.DiskIsFull') : invalidGameDataPath.value ? getDirErroText(invalidGameDataPath.value) : undefined)
const env = injection(kEnvironment)
const {
  selectedLocale,
  locales: rawLocales,
  enableDedicatedGPUOptimization,
} = useSettings()
const { t } = useI18n()
const locales = computed(() => rawLocales.value.map(({ locale, name }) => ({ text: name, value: locale })))

const { show } = useDialog('migration')
const { root, showGameDirectory } = useGameDirectory()
async function browseRootDir() {
  show()
}

const { show: onMigrateFromOther } = useDialog('migrate-wizard')
</script>
