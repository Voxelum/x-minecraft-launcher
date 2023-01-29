<template>
  <v-container
    fluid
    class="overflow-auto h-full"
  >
    <SettingGeneral />
    <SettingYggdrasilServices />
    <SettingGlobal />
    <SettingUpdate />
    <SettingAppearance />
    <SettingUpdateInfoDialog />
    <SettingMigrationDialog />
  </v-container>
</template>

<script lang=ts setup>
import SettingUpdateInfoDialog from './SettingUpdateInfoDialog.vue'
import SettingAppearance from './SettingAppearance.vue'
import SettingUpdate from './SettingUpdate.vue'
import SettingGeneral from './SettingGeneral.vue'
import SettingMigrationDialog from './SettingMigrationDialog.vue'
import SettingGlobal from './SettingGlobal.vue'
import SettingYggdrasilServices from './SettingYggdrasilServices.vue'
</script>
