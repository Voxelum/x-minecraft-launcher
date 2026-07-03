<template>
  <SettingCard :title="t('BaseSettingGeneral.title')" icon="badge">
    <SettingItem
      long-action
      :title="t('instance.name')"
      :description="t('instance.nameHint')"
    >
      <template #preaction>
        <v-menu
          v-model="changeIconModel"
          :close-on-content-click="false"
          location="end"
        >
          <template #activator="{ props: activatorProps }">
            <v-avatar
              id="instance-icon"
              v-shared-tooltip="() => t('instance.changeIcon')"
              v-ripple
              size="56"
              rounded="lg"
              v-bind="activatorProps"
              class="cursor-pointer base-setting-general__icon"
              :class="{ 'base-setting-general__icon--empty': !data.icon }"
            >
              <v-img
                v-if="data.icon"
                :src="data.icon"
                :width="56"
                :height="56"
              />
              <v-icon v-else size="28">
                add_photo_alternate
              </v-icon>
            </v-avatar>
          </template>
          <AppChangeInstanceIconCard
            :color="highlighted ? 'info' : ''"
            v-model:icon="data.icon"
          />
        </v-menu>
      </template>
      <template #action>
        <v-text-field
          v-model="data.name"
          variant="outlined"
          density="compact"
          hide-details
          :placeholder="isBedrock ? t('instances.editionBedrock') : `Minecraft ${data.runtime.minecraft}`"
        />
      </template>
    </SettingItem>
  </SettingCard>

  <SettingCard v-if="!isBedrock" :title="t('setting.quickLaunchSettings')" icon="flash_on">
    <SettingItemCheckbox
      v-model="hideLauncher"
      :title="t('instanceSetting.hideLauncher')"
    >
      <BaseSettingGlobalLabel
        :global="isGlobalHideLauncher"
        @clear="resetHideLauncher"
      />
    </SettingItemCheckbox>
    <v-divider class="my-2" />
    <SettingItemCheckbox
      v-model="showLog"
      :title="t('instanceSetting.showLog')"
    >
      <BaseSettingGlobalLabel
        :global="isGlobalShowLog"
        @clear="resetShowLog"
      />
    </SettingItemCheckbox>
  </SettingCard>

  <SettingCard
    v-if="isThirdparty || isElyBy"
    :title="t('setting.authenticationSettings')"
    icon="security"
  >
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
    <v-divider v-if="isThirdparty && isElyBy" class="my-2" />
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
  </SettingCard>
</template>

<script lang=ts setup>
import AppChangeInstanceIconCard from '@/components/AppChangeInstanceIconCard.vue'
import SettingCard from '@/components/SettingCard.vue'
import SettingItem from '@/components/SettingItem.vue'
import SettingItemCheckbox from '@/components/SettingItemCheckbox.vue'
import { useQuery } from '@/composables/query'
import { kInstance } from '@/composables/instance'
import { kInstanceLaunch } from '@/composables/instanceLaunch'
import { useGamepadAction } from '@/composables/gamepad'
import { kUserContext } from '@/composables/user'
import { vSharedTooltip } from '@/directives/sharedTooltip'
import { injection } from '@/util/inject'
import { useTimeout } from '@vueuse/core'
import { AUTHORITY_MICROSOFT } from '@xmcl/runtime-api'
import { InstanceEditInjectionKey } from '../composables/instanceEdit'
import BaseSettingGlobalLabel from '@/components/BaseSettingGlobalLabel.vue'

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
const { instance } = injection(kInstance)
const isBedrock = computed(() => instance.value.edition === 'bedrock')

const isThirdparty = computed(() => userProfile.value.authority !== AUTHORITY_MICROSOFT)
const isElyBy = computed(() => userProfile.value.authority.startsWith('https://authserver.ely.by'))

const { t } = useI18n()

// Gamepad X on the base-setting general tab launches the game.
const { launch: launchGame } = injection(kInstanceLaunch)
useGamepadAction('X', {
  label: () => t('gamepad.guide.launch'),
  handler: () => launchGame(),
})

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

<style scoped>
.base-setting-general__icon {
  background-color: rgba(var(--v-theme-on-surface), 0.06);
  transition: outline-color 0.15s ease;
  outline: 2px solid transparent;
}
.base-setting-general__icon:hover {
  outline-color: rgb(var(--v-theme-primary));
}
.base-setting-general__icon--empty {
  border: 1px dashed rgba(var(--v-theme-on-surface), 0.24);
}
</style>
