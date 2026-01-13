<template>
  <SettingCard
    v-if="!disableUpdate"
    :title="t('setting.update')"
    icon="rocket_launch"
  >
    <v-list class="transparent-list">
      <v-list-item>
        <v-list-item-action class="self-center">
          <v-btn
            v-shared-tooltip="_ => t('setting.checkUpdate')"
            icon
            :loading="checkingUpdate"
            @click="checkUpdate"
          >
            <v-icon>refresh</v-icon>
          </v-btn>
        </v-list-item-action>
        
        <v-list-item-content>
          <v-list-item-title class="font-weight-medium">
            {{ t("setting.latestVersion") }}
          </v-list-item-title>
          <v-list-item-subtitle>
            <span :class="{'success--text': !hasNewUpdate, 'primary--text': hasNewUpdate}">
              v{{ version }}
              {{ hasNewUpdate && updateInfo ? `-> ${updateInfo.name}` : "" }}
            </span>
            <v-chip
              v-if="hasNewUpdate"
              x-small
              color="primary"
              class="ml-2"
              label
            >
              NEW
            </v-chip>
          </v-list-item-subtitle>
        </v-list-item-content>
        
        <v-list-item-action class="self-center">
          <v-btn
            :loading="checkingUpdate || installing"
            :disabled="updateStatus === 'none'"
            :color="updateStatus !== 'none' ? 'primary' : ''"
            :outlined="updateStatus === 'none'"
            small
            @click="showUpdateInfo()"
          >
            <v-icon left small v-if="updateStatus !== 'none'">system_update</v-icon>
            {{
              updateStatus === "none"
                ? t("launcherUpdate.alreadyLatest")
                : updateStatus === "pending"
                  ? t("launcherUpdate.updateToThisVersion")
                  : t("launcherUpdate.installAndQuit")
            }}
          </v-btn>
        </v-list-item-action>
      </v-list-item>
    </v-list>
  </SettingCard>
</template>

<script lang="ts" setup>
import { computed } from 'vue'
import { useI18n } from 'vue-i18n-bridge'
import { vSharedTooltip } from '@/directives/sharedTooltip'
import { injection } from '@/util/inject'
import { useDialog } from '../composables/dialog'
import { kUpdateSettings } from '../composables/setting'
import SettingCard from '@/components/SettingCard.vue'

const { show: showUpdateInfo } = useDialog('update-info')
const disableUpdate = false // state.env !== 'raw'
const { updateInfo, installing, updateStatus, checkUpdate, checkingUpdate, version } = injection(kUpdateSettings)
const hasNewUpdate = computed(() => updateInfo.value?.name !== version.value)
const { t } = useI18n()

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
</style>
