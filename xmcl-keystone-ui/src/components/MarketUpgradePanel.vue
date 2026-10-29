<template>
  <v-card
    class="market-upgrade-card rounded-xl border border-white/10 bg-white/[0.02] p-4 mb-4"
    elevation="0"
  >
    <div class="flex items-center text-sm font-semibold mb-3 gap-2">
      <v-icon size="18" color="primary">upgrade</v-icon>
      <span>{{ t('shared.checkUpgrade') }}</span>
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
          rounded="lg"
          variant="outlined"
          @update:model-value="emit('update:upgradePolicy', $event)"
        >
          <v-btn
            v-shared-tooltip="'Modrinth > Curseforge'"
            value="modrinth"
            size="small"
          >
            <v-icon size="small">xmcl:modrinth</v-icon>
            <v-icon size="small">xmcl:curseforge</v-icon>
          </v-btn>
          <v-btn
            v-shared-tooltip="'Curseforge > Modrinth'"
            value="curseforge"
            size="small"
          >
            <v-icon size="small">xmcl:curseforge</v-icon>
            <v-icon size="small">xmcl:modrinth</v-icon>
          </v-btn>

          <v-btn
            v-shared-tooltip="'Modrinth'"
            value="modrinthOnly"
            size="small"
          >
            <v-icon size="small">xmcl:modrinth</v-icon>
          </v-btn>

          <v-btn
            v-shared-tooltip="'Curseforge'"
            value="curseforgeOnly"
            size="small"
          >
            <v-icon size="small">xmcl:curseforge</v-icon>
          </v-btn>
        </v-btn-toggle>
      </template>
    </SettingItem>
    <slot name="extra" />
    <div class="flex items-center gap-2 mt-4 pt-3 border-t border-white/10">
      <v-btn
        :loading="refreshing"
        variant="tonal"
        color="primary"
        @click="emit('check-upgrade')"
      >
        <v-icon start> refresh </v-icon>
        {{ t('shared.checkUpgrade') }}
      </v-btn>
      <v-spacer />
      <v-btn
        color="primary"
        variant="flat"
        :loading="upgrading"
        :disabled="Object.keys(plans).length === 0"
        @click="emit('upgrade')"
      >
        <v-icon start> upgrade </v-icon>
        {{ t('shared.upgrade') }}
        <template v-if="Object.keys(plans).length > 0">
          ({{ Object.keys(plans).length }})
        </template>
      </v-btn>
    </div>
  </v-card>
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
