<template>
  <v-list
    class="base-settings"
    two-line
    subheader
  >
    <v-subheader style="">
      {{ t("BaseSettingGeneral.title") }}
    </v-subheader>

    <v-list-item>
      <v-list-item-action class="self-center">
        <v-menu
          :close-on-content-click="false"
          :nudge-width="380"
          offset-x
        >
          <template #activator="{ on, attrs }">
            <v-avatar
              id="instance-icon"
              v-ripple
              size="40"
              v-bind="attrs"
              v-on="on"
            >
              <img
                v-if="data.icon"
                :src="data.icon"
              >
              <v-icon v-else>
                add
              </v-icon>
            </v-avatar>
          </template>

          <v-card>
            <v-list>
              <v-list-item>
                <v-list-item-content>
                  <v-list-item-title>
                    {{ t('instance.icon') }}
                  </v-list-item-title>
                </v-list-item-content>
              </v-list-item>
            </v-list>

            <v-divider />

            <v-list>
              <v-list-item>
                <v-text-field
                  v-model="data.icon"
                  :label="t('instance.iconUrl')"
                  small
                  hide-details
                  outlined
                  filled
                  dense
                />
                <v-list-item-action>
                  <v-btn
                    icon
                    @click="pickIconFile"
                  >
                    <v-icon>
                      upload_file
                    </v-icon>
                  </v-btn>
                </v-list-item-action>
              </v-list-item>
            </v-list>
          </v-card>
        </v-menu>
      </v-list-item-action>

      <v-list-item-content>
        <v-list-item-title>{{ t("instance.name") }}</v-list-item-title>
        <v-list-item-subtitle>
          {{ t("instance.nameHint") }}
        </v-list-item-subtitle>
      </v-list-item-content>
      <v-list-item-action>
        <v-text-field
          v-model="data.name"
          small
          hide-details
          outlined
          filled
          dense
          :placeholder="`Minecraft ${data.runtime.minecraft}`"
        />
      </v-list-item-action>
    </v-list-item>

    <VersionInputMinecraft
      :value="data.runtime.minecraft"
      @input="onSelectMinecraft"
    />
    <VersionInputNeoForged
      v-if="!data.runtime.labyMod"
      :value="data.runtime.neoForged"
      :minecraft="data.runtime.minecraft"
      @input="onSelectNeoForged"
    />
    <VersionInputForge
      v-if="!data.runtime.labyMod"
      :value="data.runtime.forge"
      :minecraft="data.runtime.minecraft"
      @input="onSelectForge"
    />
    <VersionInputFabric
      v-if="!data.runtime.labyMod"
      :value="data.runtime.fabricLoader"
      :minecraft="data.runtime.minecraft"
      @input="onSelectFabric"
    />
    <VersionInputQuilt
      v-if="!data.runtime.labyMod"
      :value="data.runtime.quiltLoader"
      :minecraft="data.runtime.minecraft"
      @input="onSelectQuilt"
    />
    <VersionInputOptifine
      v-if="!data.runtime.labyMod"
      :value="data.runtime.optifine"
      :forge="data.runtime.forge || ''"
      :minecraft="data.runtime.minecraft"
      @input="onSelectOptifine"
    />
    <VersionInputLabymod
      v-if="data.runtime.labyMod"
      :value="data.runtime.labyMod"
      :minecraft="data.runtime.minecraft"
      @input="onSelectLabyMod"
    />
    <VersionInputLocal
      :value="data.version"
      :versions="versions"
      @input="onSelectLocalVersion"
    />
    <v-list-item
      @click="fastLaunch = !fastLaunch"
    >
      <v-list-item-action>
        <v-checkbox
          v-model="fastLaunch"
          hide-details
          @click.stop
        />
      </v-list-item-action>
      <v-list-item-content>
        <v-list-item-title>
          {{ t("instanceSetting.fastLaunch") }}
          <BaseSettingGlobalLabel
            :global="isGlobalFastLaunch"
            @clear="resetFastLaunch"
          />
        </v-list-item-title>
        <v-list-item-subtitle>
          {{ t("instanceSetting.fastLaunchHint") }}
        </v-list-item-subtitle>
      </v-list-item-content>
    </v-list-item>

    <v-list-item
      @click="hideLauncher = !hideLauncher"
    >
      <v-list-item-action>
        <v-checkbox
          v-model="hideLauncher"
          hide-details
          @click.stop
        />
      </v-list-item-action>
      <v-list-item-content>
        <v-list-item-title>
          {{
            t("instanceSetting.hideLauncher")
          }}
          <BaseSettingGlobalLabel
            :global="isGlobalHideLauncher"
            @clear="resetHideLauncher"
          />
        </v-list-item-title>
      </v-list-item-content>
    </v-list-item>
    <v-list-item
      @click="showLog = !showLog"
    >
      <v-list-item-action>
        <v-checkbox
          v-model="showLog"
          hide-details
          @click.stop
        />
      </v-list-item-action>
      <v-list-item-content>
        <v-list-item-title>
          {{ t("instanceSetting.showLog") }}
          <BaseSettingGlobalLabel
            :global="isGlobalShowLog"
            @clear="resetShowLog"
          />
        </v-list-item-title>
        <v-list-item-subtitle>
          {{ t("instanceSetting.showLogHint") }}
        </v-list-item-subtitle>
      </v-list-item-content>
    </v-list-item>
  </v-list>
</template>

<script lang=ts setup>
import VersionInputFabric from '@/components/VersionInputFabric.vue'
import VersionInputForge from '@/components/VersionInputForge.vue'
import VersionInputLabymod from '@/components/VersionInputLabymod.vue'
import VersionInputLocal from '@/components/VersionInputLocal.vue'
import VersionInputMinecraft from '@/components/VersionInputMinecraft.vue'
import VersionInputNeoForged from '@/components/VersionInputNeoForged.vue'
import VersionInputOptifine from '@/components/VersionInputOptifine.vue'
import VersionInputQuilt from '@/components/VersionInputQuilt.vue'
import { kLocalVersions } from '@/composables/versionLocal'
import { injection } from '@/util/inject'
import { InstanceEditInjectionKey, useInstanceEditVersions } from '../composables/instanceEdit'
import BaseSettingGlobalLabel from './BaseSettingGlobalLabel.vue'

const {
  data,
  isGlobalFastLaunch,
  fastLaunch,
  resetFastLaunch,
  isGlobalHideLauncher,
  hideLauncher,
  resetHideLauncher,
  isGlobalShowLog,
  showLog,
  resetShowLog,
} = injection(InstanceEditInjectionKey)
const { showOpenDialog } = windowController
const { versions } = injection(kLocalVersions)

function pickIconFile() {
  showOpenDialog({
    title: t('instanceSetting.icon'),
    filters: [
      {
        name: t('instanceSetting.icon'),
        extensions: ['png', 'jpg', 'jpeg', 'bmp', 'gif'],
      },
    ],
    properties: ['openFile'],
  }).then((result) => {
    if (result.canceled) return
    const filePath = result.filePaths[0]
    if (filePath) {
      data.icon = `http://launcher/media?path=${filePath}`
    }
  })
}

const {
  onSelectMinecraft,
  onSelectNeoForged,
  onSelectForge,
  onSelectFabric,
  onSelectQuilt,
  onSelectOptifine,
  onSelectLabyMod,
  onSelectLocalVersion,
} = useInstanceEditVersions(data, versions)

const { t } = useI18n()

</script>

<style scoped=true>
.flex {
  padding: 6px 8px !important
}
.v-btn {
  margin: 0
}
</style>
