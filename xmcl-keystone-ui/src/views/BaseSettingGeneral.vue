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
          v-model="changeIconModel"
          :close-on-content-click="false"
          :nudge-width="380"
          offset-x
        >
          <template #activator="{ on, attrs }">
            <v-avatar
              id="instance-icon"
              v-ripple
              size="80"
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

          <AppChangeInstanceIconCard :icon.sync="data.icon" />
        </v-menu>
      </v-list-item-action>
      <v-list-item-content>
        <v-list-item-subtitle>
          {{ t("instance.iconHint") }}
        </v-list-item-subtitle>
        <div class="mt-1">
          <v-btn
            outlined
            text
            @click="changeIconModel = true"
          >
            {{ t("instance.changeIcon") }}
          </v-btn>
        </div>
      </v-list-item-content>

      <div class="w-60">
        <v-text-field
          v-model="data.name"
          :label="t('instance.name')"
          :hint="t('instance.nameHint')"
          filled
          dense
          :placeholder="`Minecraft ${data.runtime.minecraft}`"
        />
      </div>
    </v-list-item>

    <v-divider class="mb-4 mt-2" />
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
    <SettingItemCheckbox
      v-model="fastLaunch"
      :title="t('instanceSetting.fastLaunch')"
      :description="t('instanceSetting.fastLaunchHint')"
    >
      <BaseSettingGlobalLabel
        :global="isGlobalFastLaunch"
        @clear="resetFastLaunch"
      />
    </SettingItemCheckbox>
    <SettingItemCheckbox
      v-model="hideLauncher"
      :title="t('instanceSetting.hideLauncher')"
    >
      <BaseSettingGlobalLabel
        :global="isGlobalHideLauncher"
        @clear="resetHideLauncher"
      />
    </SettingItemCheckbox>
    <SettingItemCheckbox
      v-model="showLog"
      :title="t('instanceSetting.showLog')"
    >
      <BaseSettingGlobalLabel
        :global="isGlobalShowLog"
        @clear="resetShowLog"
      />
    </SettingItemCheckbox>
    <SettingItemCheckbox
      v-if="isThirdparty"
      v-model="disableAuthlibInjector"
      :title="t('instanceSetting.disableAuthlibInjector')"
      :description="t('instanceSetting.disableAuthlibInjectorDescription')"
    >
      <BaseSettingGlobalLabel
        :global="isGlobalDisableAuthlibInjector"
        @clear="resetDisableAuthlibInjector"
      />
    </SettingItemCheckbox>
    <SettingItemCheckbox
      v-if="isElyBy"
      v-model="disableElyByAuthlib"
      :title="t('instanceSetting.disableElyByAuthlib')"
      :description="t('instanceSetting.disableElyByAuthlibDescription')"
    >
      <BaseSettingGlobalLabel
        :global="isGlobalDisableElyByAuthlib"
        @clear="resetDisableElyByAuthlib"
      />
    </SettingItemCheckbox>
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
import SettingItemCheckbox from '@/components/SettingItemCheckbox.vue'
import { kUserContext } from '@/composables/user'
import { AUTHORITY_MICROSOFT } from '@xmcl/runtime-api'
import AppChangeInstanceIconCard from '@/components/AppChangeInstanceIconCard.vue'

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
  disableAuthlibInjector,
  disableElyByAuthlib,
  isGlobalDisableAuthlibInjector,
  isGlobalDisableElyByAuthlib,
  resetDisableAuthlibInjector,
  resetDisableElyByAuthlib,
} = injection(InstanceEditInjectionKey)
const { versions } = injection(kLocalVersions)
const { userProfile } = injection(kUserContext)

const isThirdparty = computed(() => userProfile.value.authority !== AUTHORITY_MICROSOFT)
const isElyBy = computed(() => userProfile.value.authority.startsWith('https://authserver.ely.by'))

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

const changeIconModel = ref(false)

</script>

<style scoped=true>
.flex {
  padding: 6px 8px !important
}
.v-btn {
  margin: 0
}
</style>
