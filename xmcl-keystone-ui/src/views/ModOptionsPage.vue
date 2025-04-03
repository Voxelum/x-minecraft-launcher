<template>
  <div class="w-full mod-options-page overflow-auto">
    <v-subheader>
      {{ t('dependencies.name') }}
    </v-subheader>
    <SettingItem
      :title="t('modInstall.checkDependencies')"
      :description="checkedDependencies ? t('modInstall.checkedDependencies') : t('modInstall.checkDependencies')"
    >
      <template #preaction>
        <v-btn
          icon
          v-shared-tooltip="_ => t('refresh')"
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
      <template #action>
        <div class="flex">
          <v-btn
            text
            :loading="installingDependencies"
            :disabled="dependenciesToUpdate.length === 0"
            @click="installDependencies"
          >
            <v-icon left class="material-icons-outlined">
              file_download
            </v-icon>
            {{ t('install') }}
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
          v-shared-tooltip="_ => t('refresh')"
          :loading="scanningUnusedMods"
          :disabled="mods.length === 0 || scanningUnusedMods"
          @click="scanUnusedMods"
        >
          <v-icon class="material-icons-outlined">
            restart_alt
          </v-icon>
        </v-btn>
      </template>
      <template #action>
        <div class="flex gap-2">
          <v-btn
            color="red"
            :loading="scanningUnusedMods"
            :disabled="unusedMods.length === 0"
            @click="onCleanUnused"
          >
            <v-icon left>
              delete
            </v-icon>
            {{ t('remove') }}
          </v-btn>
        </div>
      </template>
    </SettingItem>
    <v-divider />
    <v-subheader>
        {{ t('modInstall.checkUpgrade') }}
    </v-subheader>
    <SettingItem
      :title="t('modUpgradePolicy.name')"
      :description="t(`modUpgradePolicy.${upgradePolicy}`) "
    >
      <template #action>
        <v-btn-toggle
          v-model="upgradePolicy"
          mandatory
          color="primary"
        >
          <v-btn
            small
            outlined
            value="modrinth"
          >
            <v-icon small>$vuetify.icons.modrinth</v-icon>
            <v-icon small>$vuetify.icons.curseforge</v-icon>
          </v-btn>
          <v-btn
            small
            outlined
            value="curseforge"
          >
            <v-icon small>$vuetify.icons.curseforge</v-icon>
            <v-icon small>$vuetify.icons.modrinth</v-icon>
          </v-btn>

          <v-btn
            small
            outlined
            value="modrinthOnly"
          >
            <v-icon small>$vuetify.icons.modrinth</v-icon>
          </v-btn>

          <v-btn
            small
            outlined
            value="curseforgeOnly"
          >
            <v-icon small>$vuetify.icons.curseforge</v-icon>
          </v-btn>
        </v-btn-toggle>
      </template>
    </SettingItem>
    <SettingItemCheckbox
      :value="skipVersion"
      :title="t('modInstall.skipVersion')"
      @input="skipVersion = $event"
    />
    <SettingItem>
      <template #action>
        <div class="flex gap-1">
          <v-btn
            large
            text
            :loading="checkingUpgrade"
            @click="onCheckUpgrade"
          >
            <v-icon left>
              refresh
            </v-icon>
            {{ t('modInstall.checkUpgrade') }}
          </v-btn>
          <v-spacer />
          <v-btn
            large
            :loading="upgrading"
            :disabled="Object.keys(plans).length === 0"
            @click="upgrade"
          >
            <v-icon left>
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