<template>
  <v-list
    three-line
    subheader
    style="background: transparent; width: 100%"
  >
    <v-subheader class>
      {{ t("setting.general") }}
    </v-subheader>
    <v-list-item>
      <v-list-item-content>
        <v-list-item-title>
          {{
            t("setting.language")
          }}
        </v-list-item-title>
        <v-list-item-subtitle>
          {{
            t("setting.languageDescription")
          }}
        </v-list-item-subtitle>
      </v-list-item-content>
      <v-list-item-action>
        <v-select
          v-model="selectedLocale"
          filled
          style="max-width: 185px"
          hide-details
          :items="locales"
        />
      </v-list-item-action>
    </v-list-item>
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
          @click="showRootDir"
        >
          {{ t("setting.showRoot") }}
        </v-btn>
      </v-list-item-action>
    </v-list-item>
    <v-list-item>
      <v-list-item-content>
        <v-list-item-title>
          {{
            t("setting.useBmclAPI")
          }}
        </v-list-item-title>
        <v-list-item-subtitle>
          {{
            t("setting.useBmclAPIDescription")
          }}
        </v-list-item-subtitle>
      </v-list-item-content>
      <v-list-item-action>
        <v-select
          v-model="apiSetsPreference"
          filled
          style="max-width: 185px"
          hide-details
          :items="apiSets"
          item-text="name"
        />
      </v-list-item-action>
    </v-list-item>
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
      <v-list-item-action class="flex flex-row flex-grow-0 gap-1">
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
  </v-list>
</template>
<script lang="ts" setup>
import { BaseServiceKey } from '@xmcl/runtime-api'
import { useDialog } from '../composables/dialog'
import { localeMappings } from '/@/util/localeMappings'
import { useSettings } from '../composables/setting'
import { useI18n, useService } from '/@/composables'

const { openDirectory } = useService(BaseServiceKey)

const {
  root,
  proxy, httpProxyEnabled, apiSets, allowPrerelease,
  apiSetsPreference,
  selectedLocale,
  locales: rawLocales,
} = useSettings()
const locales = rawLocales.value.map(l => ({ text: localeMappings[l] ?? l, value: l }))

const { t } = useI18n()
const { show } = useDialog('migration')

function showRootDir() {
  openDirectory(root.value)
}
async function browseRootDir() {
  show()
}

</script>

<i18n locale="en" lang="yaml">
setting:
  general: General
  language: Language
  languageDescription: The display language
  location: Store Location
  browseRoot: Browse
  showRoot: Show
  useBmclAPI: Use BMCL API
  useBmclAPIDescription: >-
    Use BMCLAPI to download Minecraft when you are in China Mainland. (This
    won't affect if you're not in China mainland)
  useProxy: HTTP Proxy
  useProxyDescription: The proxy server address for the http request
proxy:
  host: Host
  port: Port
</i18n>

<i18n locale="zh-CN" lang="yaml">
setting:
  general: 基本设置
  language: 语言
  languageDescription: 当前显示的语言
  location: 数据存储位置
  browseRoot: 更改
  showRoot: 浏览
  useBmclAPI: 使用 BMCL API
  useBmclAPIDescription: 当你在大陆时，优先使用 BMCLAPI 来下载 Minecraft
  useProxy: HTTP 代理设置
  useProxyDescription: 使用代理服务器可以某些服务的访问
proxy:
  host: 服务器地址
  port: 端口号
</i18n>
<i18n locale="zh-TW" lang="yaml">
setting:
  general: 基本設置
  language: 語言
  languageDescription: 當前顯示的語言
  location: 數據存儲位置
  browseRoot: 更改
  showRoot: 瀏覽
  useBmclAPI: 使用 BMCL API
  useBmclAPIDescription: 當你在大陸時，優先使用 BMCLAPI 來下載 Minecraft
  useProxy: HTTP 代理設置
  useProxyDescription: 使用代理服務器可以某些服務的訪問
proxy:
  host: 服務器地址
  port: 端口號
</i18n>
<i18n locale="ru" lang="yaml">
setting:
  general: Общие
  language: Язык
  languageDescription: Язык программы
  location: Расположение хранилища
  browseRoot: Обзор
  showRoot: Показать
  useBmclAPI: Использовать BMCLAPI
  useBmclAPIDescription: >-
    Используйте BMCLAPI для скачивания Minecraft, если вы находитесь на Материке
    Китая. (Это не повлияет, если вы не на Материке Китая)
  useProxy: HTTP-прокси
  useProxyDescription: Адрес прокси-сервера для http-запроса
proxy:
  host: Хост
  port: Порт
</i18n>
