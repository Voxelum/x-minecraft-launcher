<template>
  <div class="settings-page">
    <SettingHeader>
      🌐 {{ t('setting.network') }}
    </SettingHeader>

    <div class="content-grid">
      <!-- API Settings -->
      <div class="settings-card">
        <h3 class="card-title">
          <v-icon class="title-icon">api</v-icon>
          {{ t('setting.apiSettings') }}
        </h3>
        <div class="settings-list">
          <SettingItemSelect :select.sync="apiSetsPreference" :title="''" :text="t('setting.useBmclAPI')"
            :description="t('setting.useBmclAPIDescription')" :items="apiSetItems">
            <template #title>
              {{ t('setting.useBmclAPI') }}
              <a class="primary ml-1" target="browser" href="https://bmclapidoc.bangbang93.com/">
                <v-icon small>question_mark</v-icon>
              </a>
            </template>
          </SettingItemSelect>
        </div>
      </div>

      <!-- Proxy Settings -->
      <div class="settings-card full-width">
        <h3 class="card-title">
          <v-icon class="title-icon">vpn_lock</v-icon>
          {{ t('setting.proxySettings') }}
        </h3>
        <div class="proxy-control">
          <div class="proxy-main">
            <div class="proxy-info">
              <div class="proxy-title">{{ t("setting.useProxy") }}</div>
              <div class="proxy-description">{{ t("setting.useProxyDescription") }}</div>
            </div>
            <v-checkbox v-model="httpProxyEnabled" class="proxy-checkbox" />
          </div>
          <div class="proxy-details" v-show="httpProxyEnabled">
            <div class="input-row">
              <v-text-field v-model="proxy.host" filled dense hide-details :label="t('proxy.host')"
                class="custom-input" />
              <v-text-field v-model="proxy.port" filled dense hide-details type="number" :label="t('proxy.port')"
                class="custom-input port-input" />
            </div>
          </div>
        </div>
      </div>

      <!-- Connection Settings -->
      <div class="settings-card">
        <h3 class="card-title">
          <v-icon class="title-icon">settings_ethernet</v-icon>
          {{ t('setting.connectionSettings') }}
        </h3>
        <div class="connection-control">
          <div class="connection-info">
            <div class="connection-title">{{ t("setting.maxSocketsTitle") }}</div>
            <div class="connection-description">{{ t("setting.maxSocketsDescription") }}</div>
          </div>
          <v-text-field v-model="maxSockets" filled dense hide-details type="number" :label="t('setting.maxSockets')"
            class="custom-input socket-input" />
        </div>
      </div>
    </div>
  </div>
</template>

<script lang="ts" setup>
import SettingHeader from '@/components/SettingHeader.vue'
import SettingItemCheckbox from '@/components/SettingItemCheckbox.vue'
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
    { text: t('setting.apiSets.auto'), value: '' },
    { text: t('setting.apiSets.official'), value: 'mojang' },
  ].concat(
    apiSets.value.map((v) => {
      return { text: v.name.toString().toUpperCase(), value: v.name }
    })))

const { show } = useDialog('migration')
</script>

<style scoped>
.settings-page {
  padding: 16px;
  max-width: 1200px;
  margin: 0 auto;
}

.content-grid {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(450px, 1fr));
  gap: 24px;
}

.settings-card {
  background-color: rgba(255, 255, 255, 0.04);
  border: 1px solid rgba(255, 255, 255, 0.08);
  border-radius: 12px;
  padding: 20px;
  transition: box-shadow 0.3s ease, transform 0.3s ease;
}

.settings-card:hover {
  box-shadow: 0 4px 20px rgba(0, 0, 0, 0.2);
  transform: translateY(-2px);
}

.settings-card.full-width {
  grid-column: 1 / -1;
}

.card-title {
  font-size: 1.1rem;
  font-weight: 600;
  color: rgba(255, 255, 255, 0.95);
  margin-bottom: 20px;
  display: flex;
  align-items: center;
  gap: 12px;
  padding-bottom: 12px;
  border-bottom: 1px solid rgba(255, 255, 255, 0.1);
}

.title-icon {
  color: var(--v-primary-base);
  font-size: 1.3rem;
}

.settings-list {
  display: flex;
  flex-direction: column;
  gap: 16px;
}

.proxy-control,
.connection-control {
  display: flex;
  flex-direction: column;
  gap: 16px;
}

.proxy-main {
  display: flex;
  justify-content: space-between;
  align-items: center;
}

.proxy-info,
.connection-info {
  display: flex;
  flex-direction: column;
  gap: 4px;
  flex-grow: 1;
  margin-right: 16px;
}

.proxy-title,
.connection-title {
  font-weight: 500;
  color: rgba(255, 255, 255, 0.9);
  font-size: 0.95rem;
}

.proxy-description,
.connection-description {
  color: rgba(255, 255, 255, 0.6);
  font-size: 0.8rem;
  line-height: 1.4;
}

.proxy-checkbox {
  margin: 0;
}

.proxy-details {
  padding-left: 20px;
  border-left: 2px solid rgba(255, 255, 255, 0.1);
}

.input-row {
  display: flex;
  gap: 16px;
  align-items: center;
}

.custom-input {
  background-color: rgba(255, 255, 255, 0.05);
  border-radius: 8px;
}

.custom-input.v-text-field--outlined fieldset {
  border-color: rgba(255, 255, 255, 0.2);
}

.custom-input.v-text-field--outlined:hover fieldset {
  border-color: rgba(255, 255, 255, 0.3);
}

.custom-input.v-text-field--outlined.v-input--is-focused fieldset {
  border-color: var(--v-primary-base);
}

.port-input,
.socket-input {
  max-width: 120px;
}

:deep(.v-list-item) {
  background-color: rgba(255, 255, 255, 0.03);
  border-radius: 8px;
  margin-bottom: 0;
  transition: background-color 0.2s ease;
}

:deep(.v-list-item:hover) {
  background-color: rgba(255, 255, 255, 0.06);
}

:deep(.v-list-item__title) {
  color: rgba(255, 255, 255, 0.95) !important;
  font-size: 0.95rem !important;
}

:deep(.v-list-item__subtitle) {
  color: rgba(255, 255, 255, 0.6) !important;
  font-size: 0.85rem !important;
  white-space: normal !important;
  line-height: 1.4 !important;
}
</style>
