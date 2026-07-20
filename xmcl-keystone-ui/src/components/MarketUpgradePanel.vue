<template>
  <div class="filter-subheader">
    <v-icon size="16" class="mr-1">upgrade</v-icon>
    {{ t('shared.checkUpgrade') }}
  </div>
  <SettingItem
    :title="t('modUpgradePolicy.name')"
    :description="t(`modUpgradePolicy.${upgradePolicy}`)"
  >
    <template #action>
      <v-btn-toggle
        v-roving-tabindex
        :model-value="upgradePolicy"
        :aria-label="t('modUpgradePolicy.name')"
        density="compact"
        mandatory
        color="primary"
        @update:model-value="emit('update:upgradePolicy', $event)"
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
  <slot name="extra" />
  <SettingItem>
    <template #action>
      <div class="flex gap-1">
        <v-btn :loading="refreshing" size="large" variant="text" @click="emit('check-upgrade')">
          <v-icon start> refresh </v-icon>
          {{ t('shared.checkUpgrade') }}
        </v-btn>
        <v-spacer />
        <v-btn
          color="primary"
          :loading="upgrading"
          :disabled="Object.keys(plans).length === 0"
          size="large"
          @click="emit('upgrade')"
        >
          <v-icon start> upgrade </v-icon>
          {{ t('shared.upgrade') }}
        </v-btn>
      </div>
    </template>
  </SettingItem>
</template>

<script setup lang="ts">
import { vRovingTabindex } from '@/directives/rovingTabindex'
import { vSharedTooltip } from '@/directives/sharedTooltip'
import SettingItem from './SettingItem.vue'

defineProps<{
  plans: Record<string, unknown>
  upgradePolicy: 'modrinth' | 'curseforge' | 'curseforgeOnly' | 'modrinthOnly'
  refreshing?: boolean
  upgrading?: boolean
}>()

const emit = defineEmits<{
  (e: 'update:upgradePolicy', value: 'modrinth' | 'curseforge' | 'curseforgeOnly' | 'modrinthOnly'): void
  (e: 'check-upgrade'): void
  (e: 'upgrade'): void
}>()

const { t } = useI18n()
</script>
