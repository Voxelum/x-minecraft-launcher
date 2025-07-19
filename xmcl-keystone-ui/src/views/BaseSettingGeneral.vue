<template>
  <v-list-subheader style="">
    {{ t("BaseSettingGeneral.title") }}
  </v-list-subheader>
  <v-list-item :subtitle="t('instance.iconHint')">
    <template #prepend>
      <v-menu
        v-model="changeIconModel"
        :close-on-content-click="false"
      >
        <template #activator="{ props }">
          <v-avatar
            id="instance-icon"
            v-ripple
            size="80"
            v-bind="props"
          >
            <v-img
              v-if="data.icon"
              :src="data.icon"
            />
            <v-icon v-else>
              add
            </v-icon>
          </v-avatar>
        </template>
        <AppChangeInstanceIconCard
          v-model:icon="data.icon"
          :color="highlighted ? 'info' : ''"
        />
      </v-menu>
    </template>
      
    <div class="mt-1">
      <v-btn
        variant="outlined"
        @click="changeIconModel = true"
      >
        {{ t("instance.changeIcon") }}
      </v-btn>
    </div>

    <template #append>
      <v-text-field
        v-model="data.name"
        :label="t('instance.name')"
        :hint="t('instance.nameHint')"
        variant="filled"
        density="compact"
        class="w-60"
        :placeholder="`Minecraft ${data.runtime.minecraft}`"
      />
    </template>
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
