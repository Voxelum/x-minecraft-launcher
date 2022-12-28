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
          <a
            class="underline primary ml-1"
            href="https://bmclapidoc.bangbang93.com/"
          >
            <v-icon small>
              question_mark
            </v-icon>
          </a>
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
          :items="apiSetItems"
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
      <v-list-item-action class="flex flex-row flex-grow-0 gap-1">
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
  </v-list>
</template>
<script lang="ts" setup>
import { BaseServiceKey } from '@xmcl/runtime-api'
import { useDialog } from '../composables/dialog'
import { useSettings } from '../composables/setting'
import { useService } from '@/composables'

const { openDirectory } = useService(BaseServiceKey)

const {
  root,
  proxy, httpProxyEnabled, apiSets, allowPrerelease,
  apiSetsPreference,
  selectedLocale,
  maxSockets,
  locales: rawLocales,
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
const locales = computed(() => rawLocales.value.map(({ locale, name }) => ({ text: name, value: locale })))

const { show } = useDialog('migration')

function showRootDir() {
  openDirectory(root.value)
}
async function browseRootDir() {
  show()
}

</script>
