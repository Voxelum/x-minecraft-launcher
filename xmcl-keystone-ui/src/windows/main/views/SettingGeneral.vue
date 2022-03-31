<template>
  <v-list
    three-line
    subheader
    style="background: transparent; width: 100%"
  >
    <v-subheader class>
      {{ $t("setting.general") }}
    </v-subheader>
    <v-list-item>
      <v-list-item-content>
        <v-list-item-title>
          {{
            $t("setting.language")
          }}
        </v-list-item-title>
        <v-list-item-subtitle>
          {{
            $t("setting.languageDescription")
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
            $t("setting.location")
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
          {{ $t("setting.browseRoot") }}
        </v-btn>
      </v-list-item-action>
      <v-list-item-action class="self-center">
        <v-btn
          outlined
          text
          @click="showRootDir"
        >
          {{ $t("setting.showRoot") }}
        </v-btn>
      </v-list-item-action>
    </v-list-item>
    <v-list-item>
      <v-list-item-content>
        <v-list-item-title>
          {{
            $t("setting.useBmclAPI")
          }}
        </v-list-item-title>
        <v-list-item-subtitle>
          {{
            $t("setting.useBmclAPIDescription")
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
            $t("setting.useProxy")
          }}
        </v-list-item-title>
        <v-list-item-subtitle>
          {{
            $t("setting.useProxyDescription")
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
          :label="$t('proxy.host')"
        />
        <v-text-field
          v-model="proxy.port"
          :disabled="!httpProxyEnabled"
          class="w-20"
          filled
          dense
          hide-details
          type="number"
          :label="$t('proxy.port')"
        />
      </v-list-item-action>
    </v-list-item>
  </v-list>
</template>
<script lang="ts" setup>
import { BaseServiceKey } from '@xmcl/runtime-api'
import { useDialog } from '../composables/dialog'
import { useSettings } from '../composables/setting'
import { useI18n, useService } from '/@/composables'
import localMapping from '/@/assets/localeMapping.json'
const dialog = windowController
const { openDirectory } = useService(BaseServiceKey)

const {
  root,
  proxy, httpProxyEnabled, apiSets, allowPrerelease,
  apiSetsPreference,
  selectedLocale,
  locales: rawLocales,
} = useSettings()
const locales = rawLocales.value.map(l => ({ text: (localMapping as any)[l] ?? l, value: l }))

const { $t: t } = useI18n()
const { show } = useDialog('migration')

function showRootDir() {
  openDirectory(root.value)
}
async function browseRootDir() {
  const { filePaths } = await dialog.showOpenDialog({
    title: t('setting.selectRootDirectory'),
    defaultPath: root.value,
    properties: ['openDirectory', 'createDirectory'],
  })
  if (filePaths && filePaths.length !== 0) {
    show(filePaths[0])
  }
}

</script>
