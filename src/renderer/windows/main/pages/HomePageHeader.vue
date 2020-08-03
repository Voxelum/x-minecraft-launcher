<template>
  <div
    class="display-1 white--text"
    style
  >
    <span style="margin-right: 10px;">{{ name || `Minecraft ${version.minecraft}` }}</span>
    <v-chip
      v-if="!isServer && author"
      label
      color="green"
      small
      :selected="false"
      style="margin-right: 5px;"
    >
      <v-avatar>
        <v-icon>person</v-icon>
      </v-avatar>
      {{ author }}
    </v-chip>
    <v-chip
      label
      class="pointer"
      color="green"
      small
      :selected="false"
      @click="$router.replace('/version-setting')"
    >
      <v-avatar>
        <img
          v-if="isServer"
          :src="favicon"
        />
        <v-icon v-else>power</v-icon>
      </v-avatar>
      {{ $tc('version.name', 2) }}: {{ folder === 'unknown' ? $t('version.notInstalled') : folder }}
    </v-chip>
    <v-chip
      v-if="isServer"
      label
      class="pointer"
      small
      :selected="false"
      outline
    >
      <v-avatar>
        <v-icon>people</v-icon>
      </v-avatar>
      {{ players.online }} / {{ players.max }}
    </v-chip>
    <v-chip
      v-if="isServer"
      :style="{ color: ping < 100 ? 'green' : ping < 300 ? 'orange' : 'red' }"
      label
      class="pointer"
      outline
      small
      :selected="false"
    >
      <v-avatar>
        <v-icon
          :style="{ color: ping < 100 ? 'green' : ping < 300 ? 'orange' : 'red' }"
        >
          signal_cellular_alt
        </v-icon>
      </v-avatar>
      {{ ping }} ms
    </v-chip>
  </div>
</template>

<script lang=ts>
import { defineComponent } from '@vue/composition-api';
import {
  useInstance,
  useInstanceServerStatus,
  useInstanceVersion,
} from '@/hooks';

export default defineComponent({
  setup() {
    const { runtime, name, author, isServer } = useInstance();
    const { id, folder } = useInstanceVersion();
    const { players, ping, favicon } = useInstanceServerStatus();
    return {
      version: runtime,
      name,
      author,
      isServer,
      id,
      folder,
      players,
      ping,
      favicon,
    };
  },
});
</script>
