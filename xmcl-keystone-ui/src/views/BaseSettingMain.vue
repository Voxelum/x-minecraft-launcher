<template>
  <div>
    <BaseSettingGeneral class="" />
    <BaseSettingVersions
      :is-expanded="isExpanded"
      class=""
    />
    <v-divider v-if="!isExpanded" />
  </div>
  <div>
    <BaseSettingJava class="" />
    <BaseSettingSync class="" />
    <v-list-subheader>Minecraft</v-list-subheader>
    <BaseSettingLaunch class="" />
  </div>
</template>
<script lang="ts" setup>
import { useMediaQuery } from '@vueuse/core';
import BaseSettingGeneral from './BaseSettingGeneral.vue';
import BaseSettingVersions from './BaseSettingVersions.vue';
import BaseSettingSync from './BaseSettingSync.vue';
import BaseSettingJava from './BaseSettingJava.vue';
import BaseSettingLaunch from './BaseSettingMinecraft.vue';

const isExpanded = useMediaQuery('(min-width: 1360px)')
</script>