<template>
  <SettingHeader>
    🌐 {{ t('setting.network') }}
  </SettingHeader>
  <SettingItemSelect
    v-model:select="apiSetsPreference"
    :description="t('setting.useBmclAPIDescription')"
    :items="apiSetItems"
  >
    <template #title>
      {{ t('setting.useBmclAPI') }}
      <a
        class="bg-primary ml-1 underline"
        target="browser"
        href="https://bmclapidoc.bangbang93.com/"
      >
        <v-icon size="small">
          question_mark
        </v-icon>
      </a>
    </template>
  </SettingItemSelect>
  <SettingItemCheckbox
    v-model="httpProxyEnabled"
    :title="t('setting.useProxy')"
    :description="t('setting.useProxyDescription')"
  >
    <template #append>
      <div class="flex flex-grow-0 flex-row gap-1">
        <v-text-field
          v-model="proxy.host"
          :disabled="!httpProxyEnabled"
          variant="filled"
          density="compact"
          hide-details
          :label="t('proxy.host')"
        />
        <v-text-field
          v-model="proxy.port"
          :disabled="!httpProxyEnabled"
          class="w-20"
          variant="filled"
          density="compact"
          hide-details
          type="number"
          :label="t('proxy.port')"
        />
      </div>
    </template>
  </SettingItemCheckbox>
  <v-list-item
    :title="t('setting.maxSocketsTitle')"
    :subtitle="t('setting.maxSocketsDescription')"
  >
    <template #append>
      <div class="flex flex-grow-0 flex-row gap-1">
        <v-text-field
          v-model="maxSockets"
          class="w-40"
          variant="filled"
          density="compact"
          hide-details
          type="number"
          :label="t('setting.maxSockets')"
        />
      </div>
    </template>
  </v-list-item>
</template>
<script lang="ts" setup>
import SettingHeader from '@/components/SettingHeader.vue'
import SettingItemSelect from '@/components/SettingItemSelect.vue'
import { useDialog } from '../composables/dialog'
import { useSettings } from '../composables/setting'
import SettingItemCheckbox from '@/components/SettingItemCheckbox.vue'

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
