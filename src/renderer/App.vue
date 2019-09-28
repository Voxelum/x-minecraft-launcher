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
      Vue.prototype.$copy = (text) => {
        // const clipboard = context.root.$refs.clipboard;
        // clipboard.value = text;
        // clipboard.select();
        // document.execCommand('copy');
      };
    });
    return {};
  },
};
</script>

<style>
</style>
