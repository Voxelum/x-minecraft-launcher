<template>
  <v-card class="white--text">
    <v-layout>
      <v-flex xs5 style="padding: 5px 0">
        <v-card-title>
          <v-img :src="favicon" height="125px" style="max-height: 125px;" contain />
        </v-card-title>
      </v-flex>
      <v-flex xs7>
        <v-card-title>
          <div>
            <div style="font-size: 20px;">
              {{ $t(version.name) }}
            </div>
            <text-component :source="description" />
            <div> {{ $t('profile.server.players') }} : {{ players.online + '/' + players.max }} </div>
          </div>
        </v-card-title>
      </v-flex>
    </v-layout>
    <v-divider light />
    <v-card-actions class="pa-3">
      <v-icon left style="margin-right: 16px !important" :style="{ color: ping < 100 ? 'green' : ping < 300 ? 'orange' : 'red' }">
        signal_cellular_alt
      </v-icon>
      <div>  {{ $t('profile.server.pings') }} : {{ ping }} ms </div>
        
      <v-spacer />
      <v-btn flat dark large :loading="loading" @click="refreshServer">
        <v-icon>
          refresh
        </v-icon>
      </v-btn>
    </v-card-actions>
  </v-card>
</template>

<script>
import { useServerStatus, useStore } from '@/hooks';
import { ref, onMounted } from '@vue/composition-api';

export default {
  setup() {
    const status = useServerStatus();
    const loading = ref(false);
    const { dispatch } = useStore();
    function refreshServer() {
      loading.value = true;
      dispatch('refreshProfile').finally(() => {
        loading.value = false;
      });
    }
    onMounted(() => {
      if (status.ping.value === -1) {
        refreshServer();
      }
    });
    return {
      ...status,
      loading,
      refreshServer,
    };
  },
};
</script>

<style>
</style>
