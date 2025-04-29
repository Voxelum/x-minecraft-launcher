<template>
  <div>
    <SettingHeader>
      ⚙️ {{ t("setting.general") }}
    </SettingHeader>
    <SettingItemSelect
      :select.sync="selectedLocale"
      :title="t('setting.language')"
      :description="t('setting.languageDescription')"
      :items="locales"
    />
    <v-list-item>
      <v-list-item-content>
        <v-list-item-title :color="errorText ? 'red' : ''">
          {{
            t("setting.location")
          }}
        </v-list-item-title>
        <v-list-item-subtitle class="text-red!" v-if="errorText">{{ errorText }}</v-list-item-subtitle>
        <v-list-item-subtitle v-else>{{ root }}</v-list-item-subtitle>
      </v-list-item-content>
      <v-list-item-action class="self-center mr-1">
        <v-btn
          outlined
          text
          style="margin-right: 10px"
          @click="onMigrateFromOther"
        >
          <v-icon left>
            local_shipping
          </v-icon>
          {{ t("setting.migrateFromOther") }}
        </v-btn>
      </v-list-item-action>
      <v-list-item-action class="self-center">
        <v-btn
          outlined
          text
          @click="browseRootDir"
        >
          <v-icon left>
            edit
          </v-icon>
          {{ t("setting.browseRoot") }}
        </v-btn>
      </v-list-item-action>
      <v-list-item-action class="self-center">
        <v-btn
          outlined
          text
          @click="showGameDirectory()"
        >
          <v-icon left>
            folder
          </v-icon>
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
      v-if="env?.os === 'linux' || env?.os === 'windows'"
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
      :select="replaceNative === false ? '' : replaceNative"
      :title="t('setting.replaceNative')"
      :description="t('setting.replaceNativeDescription')"
      :items="replaceNativeItems"
      @update:select="replaceNative = !$event ? false : $event"
    />
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
