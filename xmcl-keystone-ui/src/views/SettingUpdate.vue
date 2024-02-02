<template>
  <div>
    <SettingHeader v-if="!disableUpdate">
      🚀 {{ t("setting.update") }}
    </SettingHeader>
    <v-list-item v-if="!disableUpdate">
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
        <v-list-item-title>
          {{
            t("setting.latestVersion")
          }}
        </v-list-item-title>
        <v-list-item-subtitle>
          v{{ version }}
          {{
            hasNewUpdate && updateInfo ? `-> ${updateInfo.name}` : ""
          }}
        </v-list-item-subtitle>
      </v-list-item-content>
      <v-list-item-action class="self-center">
        <v-btn
          :loading="checkingUpdate || installing"
          :disabled="updateStatus === 'none'"
          :color="updateStatus !== 'none' ? 'primary' : ''"
          :text="updateStatus === 'none'"
          @click="showUpdateInfo()"
        >
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
    <!-- <v-list-item avatar>
            <v-list-item-action>
              <v-checkbox v-model="autoInstallOnAppQuit" />
            </v-list-item-action>
            <v-list-item-content>
              <v-list-item-title>{{ t('setting.autoInstallOnAppQuit') }}</v-list-item-title>
              <v-list-item-subtitle>{{ t('setting.autoInstallOnAppQuitDescription') }}</v-list-item-subtitle>
            </v-list-item-content>
          </v-list-item>
          <v-list-item avatar>
            <v-list-item-action>
              <v-checkbox
                v-model="autoDownload"

              />
            </v-list-item-action>
            <v-list-item-content>
              <v-list-item-title>{{ t('setting.autoDownload') }}</v-list-item-title>
              <v-list-item-subtitle>{{ t('setting.autoDownloadDescription') }}</v-list-item-subtitle>
            </v-list-item-content>
          </v-list-item>
          <v-list-item avatar>
            <v-list-item-action>
              <v-checkbox v-model="allowPrerelease" />
            </v-list-item-action>
            <v-list-item-content>
              <v-list-item-title>{{ t('setting.allowPrerelease') }}</v-list-item-title>
              <v-list-item-subtitle>{{ t('setting.allowPrereleaseDescription') }}</v-list-item-subtitle>
            </v-list-item-content>
        </v-list-item>-->
  </div>
</template>
<script lang="ts" setup>
import { useServiceBusy } from '@/composables'
import { BaseServiceKey } from '@xmcl/runtime-api'
import { useDialog } from '../composables/dialog'
import { useUpdateSettings } from '../composables/setting'
import { vSharedTooltip } from '@/directives/sharedTooltip'
import SettingHeader from '@/components/SettingHeader.vue'

const { show: showUpdateInfo } = useDialog('update-info')
const disableUpdate = false // state.env !== 'raw'
const { updateInfo, updateStatus, checkUpdate, checkingUpdate, version } = useUpdateSettings()
const hasNewUpdate = computed(() => updateInfo.value?.name !== version.value)
const installing = useServiceBusy(BaseServiceKey, 'quitAndInstall')
const { t } = useI18n()

</script>
