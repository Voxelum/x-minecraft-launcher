<template>
  <div class="display-1 white--text" style="">
    <span style="margin-right: 10px;">
      {{ name || `Minecraft ${version.minecraft}` }}
    </span>
    <v-chip v-if="!isServer" label color="green" small :selected="false" style="margin-right: 5px;">
      {{ author }}
    </v-chip>
    <v-chip label class="pointer" color="green" small :selected="false" @click="$router.replace('/version-setting')">
      <v-avatar v-if="isServer">
        <img :src="favicon">
      </v-avatar>
      Version: {{ version.id }}
    </v-chip>
    <v-chip v-if="isServer" label class="pointer" small :selected="false" outline>
      <v-avatar>
        <v-icon>people</v-icon>
      </v-avatar>
      {{ players.online }} / {{ players.max }} 
    </v-chip>
    <v-chip v-if="isServer" :style="{ color: ping < 100 ? 'green' : ping < 300 ? 'orange' : 'red' }" label class="pointer" outline small :selected="false">
      <v-avatar>
        <v-icon :style="{ color: ping < 100 ? 'green' : ping < 300 ? 'orange' : 'red' }">
          signal_cellular_alt
        </v-icon>
      </v-avatar>
      {{ ping }} ms  
    </v-chip>
  </div>
</template>

<script>
import {
  useCurrentProfile,
  useServerStatus,
} from '@/hooks';

export default {
  setup() {
    const { version, name, author, isServer } = useCurrentProfile();
    const { players, ping, favicon } = useServerStatus();
    return {
      version,
      name,
      author, 
      isServer,
      ...(isServer.value ? {
        players, 
        ping, 
        favicon,
      } : {
        author,
      }),
    };
  },
};
</script>
