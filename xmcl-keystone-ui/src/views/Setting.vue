<template>
  <v-list
    two-line
    subheader
    color="transparent"
    class="visible-scroll h-full w-full select-none overflow-auto p-4 xl:px-20 2xl:px-40"
  >
    <SettingGeneral />
    <SettingYggdrasilServices />
    <SettingGlobal />
    <SettingUpdate />
    <SettingAppearance />
    <SettingUpdateInfoDialog />
    <SettingMigrationDialog />
  </v-list>
</template>

<script lang=ts setup>
import SettingUpdateInfoDialog from './SettingUpdateInfoDialog.vue'
import SettingAppearance from './SettingAppearance.vue'
import SettingUpdate from './SettingUpdate.vue'
import SettingGeneral from './SettingGeneral.vue'
import SettingMigrationDialog from './SettingMigrationDialog.vue'
import SettingGlobal from './SettingGlobal.vue'
import SettingYggdrasilServices from './SettingYggdrasilServices.vue'
import { usePresence } from '@/composables/presence'

const { t } = useI18n()
usePresence(computed(() => t('presence.setting')))

</script>
