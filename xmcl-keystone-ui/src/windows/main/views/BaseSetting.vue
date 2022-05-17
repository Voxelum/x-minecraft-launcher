<template>
  <v-container
    fill-height
    class="overflow-auto"
  >
    <v-layout
      wrap
      fill-height
    >
      <v-flex
        d-flex
        xs12
        tag="h2"
        class="headline"
      >
        {{ $t("title") }}
      </v-flex>
      <BaseSettingGeneral :version="runtime" />
      <BaseSettingSync />
      <BaseSettingModpack v-if="!isServer" />
      <BaseSettingServer v-else />
      <BaseSettingJava />
      <BaseSettingLaunch :save="save" />
    </v-layout>
  </v-container>
</template>

<script lang=ts setup>
import { useInstance } from '../composables/instance'
import { InstanceEditInjectionKey, useInstanceEdit } from '../composables/instanceEdit'
import BaseSettingGeneral from './BaseSettingGeneral.vue'
import BaseSettingModpack from './BaseSettingModpack.vue'
import BaseSettingServer from './BaseSettingServer.vue'
import { useAutoSaveLoad } from '/@/composables'
import BaseSettingLaunch from './BaseSettingLaunch.vue'
import BaseSettingJava from './BaseSettingJava.vue'
import BaseSettingSync from './BaseSettingSync.vue'

const {
  runtime,
  isServer,
} = useInstance()
const { data, save, load } = useInstanceEdit()

provide(InstanceEditInjectionKey, { data, save, load })
useAutoSaveLoad(save, load)

</script>

<style scoped=true>
.flex {
  padding: 6px 8px !important
}

.v-btn {
  margin: 0
}
</style>
<style>
.local-version .v-select__selection--comma {
  max-width: 100px;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.base-settings {
  background: transparent !important;
  width: 100%;
}

.base-settings .v-text-field--box input,
.v-text-field--full-width input,
.v-text-field--outlined input {
  margin-top: 0
}

/* .base-settings .v-list__tile__content {
  flex-grow: 1
  max-width: 40%
} */
</style>

<i18n locale="en" lang="yaml">
title: Settings
</i18n>
<i18n locale="zh-CN" lang="yaml">
title: 游戏设置
</i18n>
<i18n locale="ru" lang="yaml">
title: Настройки
</i18n>
