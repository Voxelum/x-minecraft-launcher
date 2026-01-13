<template>
  <SettingCard>
    <!-- Download Source -->
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

    <v-divider class="my-2" />

    <!-- Proxy Settings -->
    <SettingItemCheckbox
      :title="t('setting.useProxy')"
      :description="t('setting.useProxyDescription')"
      v-model="httpProxyEnabled"
    />
    <v-expand-transition>
      <div v-if="httpProxyEnabled" class="px-4 py-2">
        <div class="d-flex gap-4">
          <v-text-field
            v-model="proxy.host"
            filled
            dense
            hide-details
            :label="t('proxy.host')"
            prepend-inner-icon="dns"
            class="flex-grow-1"
          />
          <v-text-field
            v-model="proxy.port"
            class="w-24 flex-grow-0"
            filled
            dense
            hide-details
            type="number"
            :label="t('proxy.port')"
            prepend-inner-icon="numbers"
          />
        </div>
      </div>
    </v-expand-transition>

    <v-divider class="my-2" />

    <SettingItem :title="t('setting.maxSocketsTitle')" :description="t('setting.maxSocketsDescription')">
      <template #action>
        <v-text-field
          v-model="maxSockets"
          class="w-32"
          filled
          dense
          hide-details
          type="number"
          :label="t('setting.maxSockets')"
          prepend-inner-icon="speed"
        />
      </template>
    </SettingItem>
  </SettingCard>
</template>

<script lang="ts" setup>
import { computed } from 'vue'
import { useI18n } from 'vue-i18n-bridge'
import SettingItemSelect from '@/components/SettingItemSelect.vue'
import { useDialog } from '../composables/dialog'
import { useSettings } from '../composables/setting'
import SettingCard from '@/components/SettingCard.vue'
import SettingItem from '@/components/SettingItem.vue'
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

<style scoped>
:deep(.transparent-list) {
  background: transparent !important;
}

.v-card {
  border-radius: 12px;
  transition: all 0.2s ease;
}

.v-card:hover {
  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.1);
}

.gap-4 {
  gap: 16px;
}
</style>
