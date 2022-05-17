<template>
  <v-container
    fluid
    class="overflow-auto h-full"
  >
    <setting-general />
    <setting-update />
    <setting-appearance />
    <update-info-dialog />
    <setting-migration-dialog />
  </v-container>
</template>

<script lang=ts setup>
import UpdateInfoDialog from './SettingUpdateInfoDialog.vue'
import SettingAppearance from './SettingAppearance.vue'
import SettingUpdate from './SettingUpdate.vue'
import SettingGeneral from './SettingGeneral.vue'
import SettingMigrationDialog from './SettingMigrationDialog.vue'
</script>
