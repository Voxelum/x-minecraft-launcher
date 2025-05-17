<template>
  <v-list
    two-line
    subheader
    color="transparent"
    class="visible-scroll select-none overflow-auto setting pt-4 pb-4"
  >
    <div class="px-4">
      <SettingGeneral />
      <SettingAppearance />
    </div>
    <div class="px-4">
      <SettingGlobal />
      <SettingUpdate />
      <SettingNetwork />
      <SettingYggdrasilServices />
    </div>
    <SettingAbout />
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
import SettingAbout from './SettingAbout.vue'
import { usePresence } from '@/composables/presence'
import { kUpdateSettings, useUpdateSettings } from '@/composables/setting'
import SettingNetwork from './SettingNetwork.vue'

const { t } = useI18n()
usePresence(computed(() => t('presence.setting')))

provide(kUpdateSettings, useUpdateSettings())

</script>
<style scoped>
@media (min-width: 1660px) {
  .setting {
    display: grid;
    grid-template-columns: 1fr 1fr;
  }

  .setting > div {
    max-width: calc(50vw - 60px);
  }
}

</style>