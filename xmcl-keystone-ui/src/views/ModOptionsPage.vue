<template>
  <div class="filter-subheader">
    <v-icon size="16" class="mr-1">account_tree</v-icon>
    {{ t('dependencies.name') }}
  </div>
  <SettingItem
    :title="t('modInstall.checkDependencies')"
    :description="
      checkedDependencies ? t('modInstall.checkedDependencies') : t('modInstall.checkDependencies')
    "
  >
    <template #preaction>
      <v-btn
        icon
        size="small"
        variant="text"
        v-shared-tooltip="() => t('shared.refresh')"
        :disabled="mods.length === 0 || checkingDependencies"
        :loading="checkingDependencies"
        @click="checkDependencies"
      >
        <v-icon :color="checkedDependencies ? 'primary' : ''">
          {{ checkedDependencies ? 'check' : 'restart_alt' }}
        </v-icon>
      </v-btn>
    </template>
    <template #action>
      <div class="flex">
        <v-btn
          :loading="installingDependencies"
          :disabled="dependenciesToUpdate.length === 0"
          @click="installDependencies"
          variant="text"
        >
          <v-icon start class="material-icons-outlined"> file_download </v-icon>
          {{ t('shared.install') }}
        </v-btn>
      </div>
    </template>
  </SettingItem>

  <SettingItem
    :title="t('modInstall.removeUnusedLibraries')"
    :disabled="mods.length === 0 || installingDependencies"
  >
    <template #preaction>
      <v-btn
        icon
        size="small"
        variant="text"
        v-shared-tooltip="() => t('shared.refresh')"
        :loading="scanningUnusedMods"
        :disabled="mods.length === 0 || scanningUnusedMods"
        @click="scanUnusedMods"
      >
        <v-icon class="material-icons-outlined"> restart_alt </v-icon>
      </v-btn>
    </template>
    <template #action>
      <div class="flex gap-2">
        <v-btn
          color="error"
          variant="text"
          :loading="scanningUnusedMods"
          :disabled="unusedMods.length === 0"
          @click="onCleanUnused"
        >
          <v-icon start> delete </v-icon>
          {{ t('shared.remove') }}
        </v-btn>
      </div>
    </template>
  </SettingItem>
  <MarketUpgradePanel
    :plans="plans"
    v-model:upgrade-policy="upgradePolicy"
    :refreshing="checkingUpgrade"
    :upgrading="upgrading"
    @check-upgrade="onCheckUpgrade"
    @upgrade="upgrade"
  >
    <template #extra>
      <SettingItemCheckbox v-model="skipVersion" :title="t('modInstall.skipVersion')" />
      <SettingItemCheckbox v-model="releaseOnly" :title="t('modInstall.releaseOnly')" />
    </template>
  </MarketUpgradePanel>
</template>

<script setup lang="ts">
import MarketUpgradePanel from '@/components/MarketUpgradePanel.vue'
import SettingItem from '@/components/SettingItem.vue'
import SettingItemCheckbox from '@/components/SettingItemCheckbox.vue'
import { kInstanceModsContext } from '@/composables/instanceMods'
import { kModDependenciesCheck } from '@/composables/modDependenciesCheck'
import { kModLibCleaner } from '@/composables/modLibCleaner'
import { kModUpgrade } from '@/composables/modUpgrade'
import { vSharedTooltip } from '@/directives/sharedTooltip'
import { injection } from '@/util/inject'

defineProps<{
  denseView: boolean
  groupInstalled: boolean
}>()

const emit = defineEmits<{
  (e: 'update:denseView', value: boolean): void
  (e: 'update:groupInstalled', value: boolean): void
}>()

const { t } = useI18n()
const { mods } = injection(kInstanceModsContext)

// Upgrade
const {
  plans,
  error: upgradeError,
  skipVersion,
  releaseOnly,
  upgradePolicy,
  refresh: checkUpgrade,
  refreshing: checkingUpgrade,
  checked: checkedUpgrade,
  upgrade,
  upgrading,
} = injection(kModUpgrade)

function onCheckUpgrade() {
  const policy = upgradePolicy.value as any
  checkUpgrade({
    skipVersion: skipVersion.value,
    releaseOnly: releaseOnly.value,
    policy,
  })
}

// Dependencies check
const {
  installation: dependenciesToUpdate,
  refresh: checkDependencies,
  refreshing: checkingDependencies,
  checked: checkedDependencies,
  apply: installDependencies,
  installing: installingDependencies,
} = injection(kModDependenciesCheck)

// Mod cleaner
const {
  unusedMods,
  refresh: scanUnusedMods,
  refreshing: scanningUnusedMods,
  apply: onCleanUnused,
} = injection(kModLibCleaner)
</script>
