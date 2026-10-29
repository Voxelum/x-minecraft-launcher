<template>
  <!-- Folder Organization Card -->
  <v-card
    class="organization-card rounded-xl border border-white/10 bg-white/[0.02] p-4 mb-4"
    elevation="0"
  >
    <div class="flex items-center text-sm font-semibold mb-2 gap-2">
      <v-icon size="18" color="primary">folder_special</v-icon>
      <span>{{ t('mod.organization') }}</span>
      <v-chip v-if="groupsCount && groupsCount > 0" size="x-small" color="primary" variant="tonal">
        {{ groupsCount }}
      </v-chip>
    </div>

    <div class="text-xs text-medium-emphasis mb-3">
      {{ t('mod.autoCategorizeHint') }}
    </div>

    <div class="flex flex-wrap items-center gap-2">
      <v-btn
        size="small"
        color="primary"
        variant="flat"
        rounded="lg"
        prepend-icon="auto_awesome"
        @click="emit('auto-categorize')"
      >
        {{ t('mod.autoCategorize') }}
      </v-btn>
      <v-btn
        v-if="groupsCount && groupsCount > 0"
        size="small"
        variant="tonal"
        rounded="lg"
        :prepend-icon="isAllCollapsed ? 'unfold_more' : 'unfold_less'"
        @click="emit('toggle-collapse-all')"
      >
        {{ isAllCollapsed ? t('mod.expandAll') : t('mod.collapseAll') }}
      </v-btn>
      <v-btn
        v-if="groupsCount && groupsCount > 0"
        size="small"
        variant="tonal"
        rounded="lg"
        prepend-icon="folder_off"
        @click="emit('ungroup-all')"
      >
        {{ t('mod.ungroupAll') }}
      </v-btn>
    </div>
  </v-card>

  <!-- Dependencies & Storage Maintenance Card -->
  <v-card
    class="dependencies-card rounded-xl border border-white/10 bg-white/[0.02] p-4 mb-4"
    elevation="0"
  >
    <div class="flex items-center text-sm font-semibold mb-3 gap-2">
      <v-icon size="18" color="primary">account_tree</v-icon>
      <span>{{ t('dependencies.name') }}</span>
    </div>

    <!-- Check Dependencies Item -->
    <div class="flex items-center justify-between py-2">
      <div class="flex-1 pr-3">
        <div class="text-sm font-medium flex items-center gap-2">
          <span>{{ t('modInstall.checkDependencies') }}</span>
          <v-chip
            v-if="checkedDependencies && dependenciesToUpdate.length > 0"
            size="x-small"
            color="warning"
            variant="flat"
          >
            {{ dependenciesToUpdate.length }} {{ t('shared.missing') }}
          </v-chip>
          <v-chip
            v-else-if="checkedDependencies"
            size="x-small"
            color="success"
            variant="tonal"
          >
            <v-icon start size="12">check</v-icon>
            {{ t('shared.healthy') }}
          </v-chip>
        </div>
        <div class="text-xs text-medium-emphasis mt-0.5">
          {{ checkedDependencies ? t('modInstall.checkedDependencies') : t('modInstall.checkDependencies') }}
        </div>
      </div>
      <div class="flex items-center gap-1">
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
        <v-btn
          size="small"
          variant="tonal"
          color="primary"
          :loading="installingDependencies"
          :disabled="dependenciesToUpdate.length === 0"
          @click="installDependencies"
        >
          <v-icon start class="material-icons-outlined" size="16"> file_download </v-icon>
          {{ t('shared.install') }}
        </v-btn>
      </div>
    </div>

    <v-divider class="my-2 opacity-20" />

    <!-- Remove Unused Libraries Item -->
    <div class="flex items-center justify-between py-2">
      <div class="flex-1 pr-3">
        <div class="text-sm font-medium flex items-center gap-2">
          <span>{{ t('modInstall.removeUnusedLibraries') }}</span>
          <v-chip
            v-if="unusedMods.length > 0"
            size="x-small"
            color="error"
            variant="flat"
          >
            {{ unusedMods.length }}
          </v-chip>
        </div>
        <div class="text-xs text-medium-emphasis mt-0.5">
          {{ unusedMods.length > 0 ? `${unusedMods.length} ${t('shared.unused')}` : t('modFilter.unusedOnly') }}
        </div>
      </div>
      <div class="flex items-center gap-1">
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
        <v-btn
          size="small"
          color="error"
          variant="tonal"
          :loading="scanningUnusedMods"
          :disabled="unusedMods.length === 0"
          @click="onCleanUnused"
        >
          <v-icon start size="16"> delete </v-icon>
          {{ t('shared.remove') }}
        </v-btn>
      </div>
    </div>
  </v-card>

  <MarketUpgradePanel
    :plans="plans"
    v-model:upgrade-policy="upgradePolicy"
    :refreshing="checkingUpgrade"
    :upgrading="upgrading"
    @check-upgrade="onCheckUpgrade"
    @upgrade="upgrade"
  >
    <template #extra>
      <div class="space-y-1 mt-2">
        <SettingItemCheckbox v-model="skipVersion" :title="t('modInstall.skipVersion')" />
        <SettingItemCheckbox v-model="releaseOnly" :title="t('modInstall.releaseOnly')" />
      </div>
    </template>
  </MarketUpgradePanel>
</template>

<script setup lang="ts">
import MarketUpgradePanel from '@/components/MarketUpgradePanel.vue'
import SettingItemCheckbox from '@/components/SettingItemCheckbox.vue'
import { kInstanceModsContext } from '@/composables/instanceMods'
import { kModDependenciesCheck } from '@/composables/modDependenciesCheck'
import { kModLibCleaner } from '@/composables/modLibCleaner'
import { kModUpgrade } from '@/composables/modUpgrade'
import { vSharedTooltip } from '@/directives/sharedTooltip'
import { injection } from '@/util/inject'

defineProps<{
  denseView: boolean
  groupsCount?: number
  isAllCollapsed?: boolean
}>()

const emit = defineEmits<{
  (e: 'update:denseView', value: boolean): void
  (e: 'auto-categorize'): void
  (e: 'ungroup-all'): void
  (e: 'toggle-collapse-all'): void
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
