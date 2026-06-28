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
  <div class="filter-subheader">
    <v-icon size="16" class="mr-1">upgrade</v-icon>
    {{ t('modInstall.checkUpgrade') }}
  </div>
  <SettingItem
    :title="t('modUpgradePolicy.name')"
    :description="t(`modUpgradePolicy.${upgradePolicy}`)"
  >
    <template #action>
      <v-btn-toggle
        v-roving-tabindex
        v-model="upgradePolicy"
        :aria-label="t('modUpgradePolicy.name')"
        density="compact"
        mandatory
        color="primary"
      >
        <v-btn
          v-shared-tooltip="'Modrinth > Curseforge'"
          value="modrinth"
          size="small"
          variant="text"
          border
        >
          <v-icon size="small">xmcl:modrinth</v-icon>
          <v-icon size="small">xmcl:curseforge</v-icon>
        </v-btn>
        <v-btn
          v-shared-tooltip="'Curseforge > Modrinth'"
          value="curseforge"
          size="small"
          variant="text"
          border
        >
          <v-icon size="small">xmcl:curseforge</v-icon>
          <v-icon size="small">xmcl:modrinth</v-icon>
        </v-btn>

        <v-btn
          v-shared-tooltip="'Modrinth'"
          value="modrinthOnly"
          size="small"
          variant="text"
          border
        >
          <v-icon size="small">xmcl:modrinth</v-icon>
        </v-btn>

        <v-btn
          v-shared-tooltip="'Curseforge'"
          value="curseforgeOnly"
          size="small"
          variant="text"
          border
        >
          <v-icon size="small">xmcl:curseforge</v-icon>
        </v-btn>
      </v-btn-toggle>
    </template>
  </SettingItem>
  <SettingItemCheckbox v-model="skipVersion" :title="t('modInstall.skipVersion')" />
  <SettingItemCheckbox v-model="releaseOnly" :title="t('modInstall.releaseOnly')" />
  <SettingItem>
    <template #action>
      <div class="flex gap-1">
        <v-btn :loading="checkingUpgrade" @click="onCheckUpgrade" size="large" variant="text">
          <v-icon start> refresh </v-icon>
          {{ t('modInstall.checkUpgrade') }}
        </v-btn>
        <v-spacer />
        <v-btn
          color="primary"
          :loading="upgrading"
          :disabled="Object.keys(plans).length === 0"
          @click="upgrade"
          size="large"
        >
          <v-icon start> upgrade </v-icon>
          {{ t('modInstall.upgrade') }}
        </v-btn>
      </div>
    </template>
  </SettingItem>
</template>

<script setup lang="ts">
import SettingItem from '@/components/SettingItem.vue'
import SettingItemCheckbox from '@/components/SettingItemCheckbox.vue'
import { vRovingTabindex } from '@/directives/rovingTabindex'
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
