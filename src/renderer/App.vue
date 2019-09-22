<template>
  <v-app dark style="background: transparent;">
    <router-view />
    <textarea ref="clipboard" readonly style="position:absolute;left:-9999px;" />
  </v-app>
</template>

<script>
import Vue from 'vue';
import { onMounted, onBeforeMount } from '@vue/composition-api';
import { ipcRenderer } from 'electron';

export default {
  setup(data, context) {
    ipcRenderer.on('copy', (text) => {
      const clipboard = context.root.$refs.clipboard;
      clipboard.value = text;
      clipboard.select();
      document.execCommand('copy');
    });
    onMounted(() => {
      Vue.prototype.$copy = (text) => {
        const clipboard = context.root.$refs.clipboard;
        clipboard.value = text;
        clipboard.select();
        document.execCommand('copy');
      };
    });
    return {};
  },
};
</script>

<style>
</style>
