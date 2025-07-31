<script setup lang="ts">
import AppExtensionRoutes from '@/components/AppExtensionRoutes.vue';

const { t } = useI18n();
</script>

<template>
  <div
    class="flex flex-1 flex-grow-0 flex-row items-center justify-start min-h-[52px]"
    :class="{
    }"
  >
    <AppExtensionRoutes
      nested
      :items="[
        { icon: 'home', title: t('home', 2), to: '/' },
        { icon: 'settings', title: t('setting.name', 2), to: '/base-setting' },
        { icon: 'share', title: t('modpack.export'), to: '/base-setting/modpack' },
      ]"
    />
  </div>
</template>