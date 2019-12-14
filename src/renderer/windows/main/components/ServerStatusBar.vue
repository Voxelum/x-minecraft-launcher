<template>
  <div class="v-alert v-alert--outline white--text" style="">
    <i aria-hidden="true" class="v-icon material-icons theme--dark v-alert__icon">
      <img :src="favicon" style="max-height: 64px;">
    </i>
    <div>
      <text-component :source="version.name" />
      <v-spacer />
      <text-component :source="description" />
    </div>
    <v-btn icon :loading="loading" style="align-self: center;" @click="refreshServer">
      <v-icon>refresh</v-icon>
    </v-btn>
  </div>  
</template>

<script lang=ts>
import { useServerStatus, useBusy } from '@/hooks';
import { onMounted } from '@vue/composition-api';

export default {
  setup() {
    const { refresh: refreshServer, description, favicon, version, ping } = useServerStatus();
    const loading = useBusy(refreshServer);
    
    onMounted(() => {
      if (ping.value === -1) {
        refreshServer();
      }
    });
    return {
      version,
      favicon,
      description,
      loading,
      refreshServer,
    };
  },
};
</script>

<style>
</style>
