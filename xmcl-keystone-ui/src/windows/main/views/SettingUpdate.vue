<template>
  <v-list
    three-line
    subheader
    style="background: transparent"
    class="flex-grow"
  >
    <v-subheader v-if="!disableUpdate">
      {{ t("setting.update") }}
    </v-subheader>
    <v-list-item v-if="!disableUpdate">
      <v-list-item-action class="self-center">
        <v-btn
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
  </v-list>
</template>
<script lang="ts" setup>
import { BaseServiceKey } from '@xmcl/runtime-api'
import { useDialog } from '../composables/dialog'
import { useLauncherVersion, useUpdateSettings } from '../composables/setting'
import { useI18n, useServiceBusy } from '/@/composables'

const { show: showUpdateInfo } = useDialog('update-info')
const disableUpdate = false // state.env !== 'raw'
const { updateInfo, updateStatus, checkUpdate, checkingUpdate, downloadingUpdate } = useUpdateSettings()
const { version, build } = useLauncherVersion()
const hasNewUpdate = computed(() => updateInfo.value?.name !== version.value)
const installing = useServiceBusy(BaseServiceKey, 'quitAndInstall')
const { t } = useI18n()

</script>

<i18n locale="en" lang="yaml">
setting:
  allowPrerelease: Download Prerelease
  allowPrereleaseDescription: Prerelease might be instable
  autoDownload: Auto Download
  autoDownloadDescription: Auto Download Update if it's Avaiable
  autoInstallOnAppQuit: Autoinstall
  autoInstallOnAppQuitDescription: Autoinstall the Update on App Quit
  checkUpdate: Check Update
  update: Update
  latestVersion: Latest Version
  viewUpdate: View Update Detail
</i18n>

<i18n locale="zh-CN" lang="yaml">
setting:
  update: 升级设置
  allowPrerelease: 是否下载抢先版
  allowPrereleaseDescription: 抢先版可能不是那么稳定
  latestVersion: 最新版本
  autoDownload: 自动下载
  autoDownloadDescription: 自动下载最新的版本
  autoInstallOnAppQuit: 自动安装
  autoInstallOnAppQuitDescription: 每次 App 退出后自动安装更新
  checkUpdate: 检查更新
</i18n>

<i18n locale="zh-TW" lang="yaml">
setting:
  update: 升級設置
  allowPrerelease: 是否下載搶先版
  allowPrereleaseDescription: 搶先版可能不是那麼穩定
  alreadyLatest: 已經是最新
  latestVersion: 最新版本
  autoDownload: 自動下載
  autoDownloadDescription: 自動下載最新的版本
  autoInstallOnAppQuit: 自動安裝
  autoInstallOnAppQuitDescription: 每次 App 退出後自動安裝更新
  checkUpdate: 檢查更新
</i18n>

<i18n locale="ru" lang="yaml">
setting:
  allowPrerelease: Скачать предрелиз
  allowPrereleaseDescription: Предрелиз может быть нестабильным
  autoDownload: Автоскачивание
  autoDownloadDescription: Автоматически скачивает обновление когда оно доступно
  autoInstallOnAppQuit: Автоустановка
  autoInstallOnAppQuitDescription: Автоматически устанавливает обновление при закрытии приложения
  checkUpdate: Проверить обновление
  update: Обновление
  viewUpdate: Сведения об обновлении
  latestVersion: Последняя версия
</i18n>
