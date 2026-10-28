<template>
  <SettingCard>
    <!-- Create Backup Item -->
    <SettingItem
      :title="t('backup.createBackupTitle')"
      :description="t('backup.createBackupDescription')"
    >
      <template #title>
        <v-icon start size="small" color="primary">archive</v-icon>
        {{ t('backup.createBackupTitle') }}
      </template>
      <template #action>
        <v-btn
          color="primary"
          variant="flat"
          data-testid="create-backup-btn"
          class="font-weight-bold"
          @click="showCreate"
        >
          <v-icon start size="small">archive</v-icon>
          {{ t('backup.create') }}
        </v-btn>
      </template>
    </SettingItem>

    <v-divider class="my-3" />

    <!-- Restore Backup Item -->
    <SettingItem
      :title="t('backup.restoreBackupTitle')"
      :description="t('backup.restoreBackupDescription')"
    >
      <template #title>
        <v-icon start size="small" color="primary">unarchive</v-icon>
        {{ t('backup.restoreBackupTitle') }}
      </template>
      <template #action>
        <v-btn
          color="primary"
          variant="outlined"
          data-testid="restore-backup-btn"
          class="font-weight-bold"
          @click="showRestore"
        >
          <v-icon start size="small">unarchive</v-icon>
          {{ t('backup.restore') }}
        </v-btn>
      </template>
    </SettingItem>

    <v-divider class="my-3" />

    <!-- Information / Cloud Sync Note -->
    <v-alert
      color="primary"
      variant="tonal"
      density="comfortable"
      icon="cloud_sync"
      class="mt-2 rounded-xl text-body-2"
    >
      <div class="font-weight-bold mb-1">
        {{ t('backup.portableArchiveNoticeTitle') }}
      </div>
      <div class="text-caption text-medium-emphasis">
        {{ t('backup.portableArchiveNoticeDescription') }}
      </div>
    </v-alert>
  </SettingCard>
</template>

<script lang="ts" setup>
import { useI18n } from 'vue-i18n'
import SettingCard from '@/components/SettingCard.vue'
import SettingItem from '@/components/SettingItem.vue'
import { useDialog } from '@/composables/dialog'

const { t } = useI18n()
const { show: showCreate } = useDialog('backup-create')
const { show: showRestore } = useDialog('backup-restore')
</script>
