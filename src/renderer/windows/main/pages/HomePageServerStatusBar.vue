<template>
  <div class="v-alert white--text" style="border-color: transparent !important">
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
import { onMounted, defineComponent } from '@vue/composition-api';
import { useInstanceServerStatus, useBusy } from '@/hooks';

export default defineComponent({
  setup() {
    const { refresh: refreshServer, description, favicon, version, ping } = useInstanceServerStatus();
    const loading = useBusy(refreshServer);
    
    onMounted(() => {
      if (ping.value <= 0) {
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
});
</script>

<style>
</style>
