<template>
  <div>
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
import SettingHeader from '@/components/SettingHeader.vue'
import SettingItemSelect from '@/components/SettingItemSelect.vue'
import { useDialog } from '../composables/dialog'
import { useSettings } from '../composables/setting'

const {
  proxy, httpProxyEnabled, apiSets,
  apiSetsPreference,
  maxSockets,
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

const { show } = useDialog('migration')
</script>
