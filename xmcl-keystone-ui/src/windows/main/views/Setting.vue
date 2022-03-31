<template>
  <v-container
    fluid
    style="z-index: 2; overflow: auto"
    class="overflow-auto h-full"
  >
    <v-layout
      class="overflow-auto h-full flex-col"
    >
      <setting-general />
      <setting-update />
      <setting-appearance />
    </v-layout>
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
