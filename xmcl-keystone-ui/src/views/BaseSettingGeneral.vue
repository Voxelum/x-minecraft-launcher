<template>
  <v-list
    class="base-settings"
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
  </v-list>
</template>

<script lang=ts setup>
import AppChangeInstanceIconCard from '@/components/AppChangeInstanceIconCard.vue'
import SettingItemCheckbox from '@/components/SettingItemCheckbox.vue'
import { useQuery } from '@/composables/query'
import { kUserContext } from '@/composables/user'
import { injection } from '@/util/inject'
import { useTimeout } from '@vueuse/core'
import { AUTHORITY_MICROSOFT } from '@xmcl/runtime-api'
import { InstanceEditInjectionKey } from '../composables/instanceEdit'
import BaseSettingGlobalLabel from './BaseSettingGlobalLabel.vue'

const changeIcon = useQuery('changeIcon')

const {
  data,
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
const { userProfile } = injection(kUserContext)

const isThirdparty = computed(() => userProfile.value.authority !== AUTHORITY_MICROSOFT)
const isElyBy = computed(() => userProfile.value.authority.startsWith('https://authserver.ely.by'))

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
