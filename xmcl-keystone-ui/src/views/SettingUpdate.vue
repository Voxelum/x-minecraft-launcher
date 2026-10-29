<template>
  <SettingCard
    v-if="!disableUpdate"
    :title="t('setting.update')"
    icon="rocket_launch"
  >
    <v-progress-linear v-if="!updateStateReady" indeterminate />
    <template v-else-if="updateUnavailable">
      <v-alert type="info" variant="tonal" class="ma-4" role="status">
        <strong>{{ t('launcherUpdate.automaticUnavailable') }}</strong>
        <div>{{ t(updateCapabilityReason === 'not-configured' ? 'launcherUpdate.automaticNotConfigured' : 'launcherUpdate.automaticNotImplemented') }}</div>
        <div>{{ t('launcherUpdate.manualCheckHint') }}</div>
        <div v-if="manualCheckRequested">{{ t('launcherUpdate.manualCheckRequired') }}</div>
      </v-alert>
      <div class="flex gap-2 px-4 pb-4">
        <v-btn variant="text" :loading="checkingUpdate" @click="checkUpdate">
          {{ t('setting.checkUpdate') }}
        </v-btn>
        <v-btn variant="text" @click="openReleases">
          {{ t('setting.githubRelease') }}
        </v-btn>
      </div>
    </template>
    <SettingItem v-else>
      <template #preaction>
        <v-btn
          data-testid="settings-check-update"
          v-shared-tooltip="() => t('setting.checkUpdate')"
          icon
          variant="text"
          :loading="checkingUpdate"
          @click="checkUpdate"
        >
          <v-icon>refresh</v-icon>
        </v-btn>
      </template>
      
      <template #title>
        {{ t("setting.latestVersion") }}
      </template>

      <template #subtitle>
        <span :class="{'success--text': !hasNewUpdate, 'primary--text': hasNewUpdate}">
          v{{ version }}
          {{ hasNewUpdate && updateInfo ? `-> ${updateInfo.name}` : "" }}
        </span>
        <v-chip
          v-if="hasNewUpdate"
          size="x-small"
          color="primary"
          class="ml-2"
          label
        >
          NEW
        </v-chip>
      </template>
      
      <template #action>
        <v-btn
          :loading="checkingUpdate || installing"
          :disabled="updateStatus === 'none'"
          :color="updateStatus !== 'none' ? 'primary' : ''"
          :outlined="updateStatus === 'none'"
          @click="showUpdateInfo()"
         size="small">
          <v-icon start size="small" v-if="updateStatus !== 'none'">system_update</v-icon>
          {{
            updateStatus === "none"
              ? t("launcherUpdate.alreadyLatest")
              : updateStatus === "pending"
                ? t("launcherUpdate.updateToThisVersion")
                : t("launcherUpdate.installAndQuit")
          }}
        </v-btn>
      </template>
    </SettingItem>
  </SettingCard>
</template>

<script lang="ts" setup>
import { computed } from 'vue'
import { useI18n } from 'vue-i18n'
import { vSharedTooltip } from '@/directives/sharedTooltip'
import { injection } from '@/util/inject'
import { useDialog } from '../composables/dialog'
import { kUpdateSettings } from '../composables/setting'
import SettingCard from '@/components/SettingCard.vue'
import SettingItem from '@/components/SettingItem.vue'

const { show: showUpdateInfo } = useDialog('update-info')
const disableUpdate = false // state.env !== 'raw'
function openReleases() {
  window.open('https://github.com/voxelum/x-minecraft-launcher/releases', 'browser')
}
const { updateInfo, installing, updateStatus, checkUpdate, checkingUpdate, version, updateStateReady, updateUnavailable, updateCapabilityReason, manualCheckRequested } = injection(kUpdateSettings)
const hasNewUpdate = computed(() => updateStatus.value !== 'none' && !!updateInfo.value?.newUpdate)
const { t } = useI18n()

</script>

<style scoped>
:deep(.transparent-list) {
  background: transparent !important;
}

.v-card {
  transition: all 0.2s ease;
}

.v-card:hover {
  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.1);
}
</style>
