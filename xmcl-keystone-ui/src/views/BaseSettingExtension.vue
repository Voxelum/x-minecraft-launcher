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
      :items="[
        { icon: 'home', title: t('back', 2), to: '/' },
        { icon: 'home', title: t('back', 2), to: '/' },
        { icon: 'share', title: t('modpack.export'), to: '/modpack-export' },
      ]"
    />
  </div>
</template>