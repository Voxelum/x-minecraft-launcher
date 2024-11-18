<template>
  <v-list
    class="base-settings"
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
          <AppChangeInstanceIconCard
            :color="highlighted ? 'info' : ''"
            :icon.sync="data.icon"
          />
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

    <v-divider class="mb-2 mt-2" />

    <v-subheader>
      {{ t('version.name', 2) }}
      <div class="flex-grow" />
      <v-btn
        icon
        @click="showAll = !showAll"
      >
        <v-icon v-if="!showAll">
          unfold_more
        </v-icon>
        <v-icon v-else>
          unfold_less
        </v-icon>
      </v-btn>
    </v-subheader>
    <VersionInputMinecraft
      :value="data.runtime.minecraft"
      @input="onSelectMinecraft"
    />
    <VersionInputNeoForged
      v-if="showNeoForged"
      :value="data.runtime.neoForged"
      :minecraft="data.runtime.minecraft"
      @input="onSelectNeoForged"
    />
    <VersionInputForge
      v-if="showForge"
      :value="data.runtime.forge"
      :minecraft="data.runtime.minecraft"
      @input="onSelectForge"
    />
    <VersionInputFabric
      v-if="showFabric"
      :value="data.runtime.fabricLoader"
      :minecraft="data.runtime.minecraft"
      @input="onSelectFabric"
    />
    <VersionInputQuilt
      v-if="showQuilt"
      :value="data.runtime.quiltLoader"
      :minecraft="data.runtime.minecraft"
      @input="onSelectQuilt"
    />
    <VersionInputOptifine
      v-if="showOptifine"
      :value="data.runtime.optifine"
      :forge="data.runtime.forge || ''"
      :minecraft="data.runtime.minecraft"
      @input="onSelectOptifine"
    />
    <VersionInputLabymod
      v-if="showLabyMod"
      :value="data.runtime.labyMod"
      :minecraft="data.runtime.minecraft"
      @input="onSelectLabyMod"
    />
    <VersionInputLocal
      :value="data.version"
      :versions="versions"
      @input="onSelectLocalVersion"
    />
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
import { useQuery } from '@/composables/query'
import { useTimeout } from '@vueuse/core'

const changeIcon = useQuery('changeIcon')

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

const showAll = ref(false)
const showForge = computed(() => showAll.value || data.runtime.forge)
const showNeoForged = computed(() => showAll.value || data.runtime.neoForged)
const showFabric = computed(() => showAll.value || data.runtime.fabricLoader)
const showQuilt = computed(() => showAll.value || data.runtime.quiltLoader)
const showOptifine = computed(() => showAll.value || data.runtime.optifine)
const showLabyMod = computed(() => showAll.value || data.runtime.labyMod)

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

onMounted(() => {
  if (changeIcon.value) {
    nextTick().then(() => {
      changeIconModel.value = true
      start()
    })
  }
})

const { ready, start } = useTimeout(500, { controls: true })
const highlighted = computed(() => !ready.value && changeIconModel.value)

</script>

<style scoped=true>
.flex {
  padding: 6px 8px !important
}
.v-btn {
  margin: 0
}
</style>
