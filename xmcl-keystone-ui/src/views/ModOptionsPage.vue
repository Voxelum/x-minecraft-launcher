<template>
  <div class="w-full mod-options-page overflow-auto">
    <v-list-subheader>
      {{ t('dependencies.name') }}
    </v-list-subheader>
    <VListItem
      :title="t('modInstall.checkDependencies')"
      :subtitle="checkedDependencies ? t('modInstall.checkedDependencies') : t('modInstall.checkDependencies')"
    >
      <template #prepend>
        <v-btn
          v-shared-tooltip="_ => t('refresh')"
          icon
          :disabled="mods.length === 0 || checkingDependencies"
          :loading="checkingDependencies"
          @click="checkDependencies"
        >
          <v-icon
            :color="checkedDependencies ? 'primary' : ''"
          >
            {{ checkedDependencies ? 'check' : 'restart_alt' }}
          </v-icon>
        </v-btn>
      </template>
      <template #append>
        <div class="flex">
          <v-btn
            variant="text"
            :loading="installingDependencies"
            :disabled="dependenciesToUpdate.length === 0"
            @click="installDependencies"
          >
            <v-icon
              start
              class="material-icons-outlined"
            >
              file_download
            </v-icon>
            {{ t('install') }}
          </v-btn>
        </div>
      </template>
    </VListItem>

    <VListItem
      :title="t('modInstall.removeUnusedLibraries')"
      :disabled="mods.length === 0 || installingDependencies"
    >
      <template #prepend>
        <v-btn
          v-shared-tooltip="_ => t('refresh')"
          icon
          :loading="scanningUnusedMods"
          :disabled="mods.length === 0 || scanningUnusedMods"
          @click="scanUnusedMods"
        >
          <v-icon class="material-icons-outlined">
            restart_alt
          </v-icon>
        </v-btn>
      </template>
      <template #append>
        <div class="flex gap-2">
          <v-btn
            color="red"
            :loading="scanningUnusedMods"
            :disabled="unusedMods.length === 0"
            @click="onCleanUnused"
          >
            <v-icon start>
              delete
            </v-icon>
            {{ t('remove') }}
          </v-btn>
        </div>
      </template>
    </VListItem>
    <v-divider />
    <v-list-subheader>
      {{ t('modInstall.checkUpgrade') }}
    </v-list-subheader>
    <VListItem
      :title="t('modUpgradePolicy.name')"
      :subtitle="t(`modUpgradePolicy.${upgradePolicy}`) "
    >
      <template #prepend>
        <v-btn-toggle
          v-model="upgradePolicy"
          mandatory
          color="primary"
        >
          <v-btn
            size="small"
            variant="outlined"
            value="modrinth"
          >
            <v-icon size="small">
              xmcl:modrinth
            </v-icon>
            <v-icon size="small">
              xmcl:curseforge
            </v-icon>
          </v-btn>
          <v-btn
            size="small"
            variant="outlined"
            value="curseforge"
          >
            <v-icon size="small">
              xmcl:curseforge
            </v-icon>
            <v-icon size="small">
              xmcl:modrinth
            </v-icon>
          </v-btn>

          <v-btn
            size="small"
            variant="outlined"
            value="modrinthOnly"
          >
            <v-icon size="small">
              xmcl:modrinth
            </v-icon>
          </v-btn>

          <v-btn
            size="small"
            variant="outlined"
            value="curseforgeOnly"
          >
            <v-icon size="small">
              xmcl:curseforge
            </v-icon>
          </v-btn>
        </v-btn-toggle>
      </template>
    </VListItem>
    <SettingItemCheckbox
      v-model="skipVersion"
      :title="t('modInstall.skipVersion')"
    />
    <SettingItem>
      <template #action>
        <div class="flex gap-1">
          <v-btn
            size="large"
            variant="text"
            :loading="checkingUpgrade"
            @click="onCheckUpgrade"
          >
            <v-icon start>
              refresh
            </v-icon>
            {{ t('modInstall.checkUpgrade') }}
          </v-btn>
          <v-spacer />
          <v-btn
            size="large"
            :loading="upgrading"
            :disabled="Object.keys(plans).length === 0"
            @click="upgrade"
          >
            <v-icon start>
              upgrade
            </v-icon>
            {{ t('modInstall.upgrade') }}
          </v-btn>
        </div>
      </template>
    </SettingItem>
  </div>  
</template>

<script setup lang="ts">
import SettingItem from '@/components/SettingItem.vue';
import SettingItemCheckbox from '@/components/SettingItemCheckbox.vue';
import { kInstanceModsContext } from '@/composables/instanceMods';
import { kModDependenciesCheck } from '@/composables/modDependenciesCheck';
import { kModLibCleaner } from '@/composables/modLibCleaner';
import { kModUpgrade } from '@/composables/modUpgrade';
import { vSharedTooltip } from '@/directives/sharedTooltip';
import { injection } from '@/util/inject';

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
const { plans, error: upgradeError, skipVersion, upgradePolicy, refresh: checkUpgrade, refreshing: checkingUpgrade, checked: checkedUpgrade, upgrade, upgrading } = injection(kModUpgrade)

function onCheckUpgrade() {
  const policy = upgradePolicy.value as any
  checkUpgrade({
    skipVersion: skipVersion.value,
    policy,
  })
}

// Dependencies check
const { installation: dependenciesToUpdate, refresh: checkDependencies, refreshing: checkingDependencies, checked: checkedDependencies, apply: installDependencies, installing: installingDependencies } = injection(kModDependenciesCheck)

// Mod cleaner
const { unusedMods, refresh: scanUnusedMods, refreshing: scanningUnusedMods, apply: onCleanUnused } = injection(kModLibCleaner)
</script>