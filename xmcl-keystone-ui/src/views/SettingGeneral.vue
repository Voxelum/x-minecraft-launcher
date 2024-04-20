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
        <v-list-item-title>
          {{
            t("setting.location")
          }}
        </v-list-item-title>
        <v-list-item-subtitle>{{ root }}</v-list-item-subtitle>
      </v-list-item-content>
      <v-list-item-action class="self-center">
        <v-btn
          outlined
          text
          style="margin-right: 10px"
          @click="browseRootDir"
        >
          {{ t("setting.browseRoot") }}
        </v-btn>
      </v-list-item-action>
      <v-list-item-action class="self-center">
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

    <SettingHeader>
      🌐 {{ t('setting.network') }}
    </SettingHeader>
    <SettingItemSelect
      :select.sync="apiSetsPreference"
      :title="''"
      :description="t('setting.useBmclAPIDescription')"
      :items="apiSetItems"
    >
      <template #title>
        {{ t('setting.useBmclAPI') }}
        <a
          class="primary ml-1 underline"
          target="browser"
          href="https://bmclapidoc.bangbang93.com/"
        >
          <v-icon small>
            question_mark
          </v-icon>
        </a>
      </template>
    </SettingItemSelect>
    <v-list-item>
      <v-list-item-action class="self-center">
        <v-checkbox v-model="httpProxyEnabled" />
      </v-list-item-action>
      <v-list-item-content>
        <v-list-item-title>
          {{
            t("setting.useProxy")
          }}
        </v-list-item-title>
        <v-list-item-subtitle>
          {{
            t("setting.useProxyDescription")
          }}
        </v-list-item-subtitle>
      </v-list-item-content>
      <v-list-item-action class="flex flex-grow-0 flex-row gap-1">
        <v-text-field
          v-model="proxy.host"
          :disabled="!httpProxyEnabled"
          filled
          dense
          hide-details
          :label="t('proxy.host')"
        />
        <v-text-field
          v-model="proxy.port"
          :disabled="!httpProxyEnabled"
          class="w-20"
          filled
          dense
          hide-details
          type="number"
          :label="t('proxy.port')"
        />
      </v-list-item-action>
    </v-list-item>
    <v-list-item>
      <v-list-item-content>
        <v-list-item-title>
          {{
            t("setting.maxSocketsTitle")
          }}
        </v-list-item-title>
        <v-list-item-subtitle>
          {{
            t("setting.maxSocketsDescription")
          }}
        </v-list-item-subtitle>
      </v-list-item-content>
      <v-list-item-action class="flex flex-grow-0 flex-row gap-1">
        <v-text-field
          v-model="maxSockets"
          class="w-40"
          filled
          dense
          hide-details
          type="number"
          :label="t('setting.maxSockets')"
        />
      </v-list-item-action>
    </v-list-item>
  </div>
</template>
<script lang="ts" setup>
import SettingItemCheckbox from '@/components/SettingItemCheckbox.vue'
import { useDialog } from '../composables/dialog'
import { useGameDirectory, useSettings } from '../composables/setting'
import SettingItemSelect from '@/components/SettingItemSelect.vue'
import SettingHeader from '@/components/SettingHeader.vue'
import { useEnvironment } from '@/composables/environment'

const env = useEnvironment()
const {
  proxy, httpProxyEnabled, apiSets,
  streamerMode,
  developerMode,
  apiSetsPreference,
  selectedLocale,
  maxSockets,
  replaceNative,
  disableTelemetry,
  enableDiscord,
  locales: rawLocales,
  enableDedicatedGPUOptimization,
} = useSettings()
const { t } = useI18n()
const apiSetItems = computed(() =>
  [
    {
      text: t('setting.apiSets.auto'),
      value: '',
    },
    {
      text: t('setting.apiSets.official'),
      value: 'mojang',
    },
  ].concat(
    apiSets.value.map((v) => {
      return {
        text: v.name.toString().toUpperCase(),
        value: v.name,
      }
    })))
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

</script>
