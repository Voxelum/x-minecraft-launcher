<template>
  <v-app dark style="background: transparent;">
    <router-view />
  </v-app>
</template>

<script>
import Vue from 'vue';
import { onMounted } from '@vue/composition-api';

export default {
  setup(data, context) {
    onMounted(() => {
    });
    return {};
  },
};
</script>

<style>
</style>
