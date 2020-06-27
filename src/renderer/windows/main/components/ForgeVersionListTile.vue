<template>
  <v-list-tile
    :key="source.version"
    :class="{ grey: selected === source.version, 'darken-1' : selected === source.version }"
    ripple
    @click="select(source)"
  >
    <v-list-tile-avatar>
      <v-icon v-if="source.status !== 'loading'">{{ source.status === 'remote' ? 'cloud' : 'folder' }}</v-icon>
      <v-progress-circular v-else :width="2" :size="24" indeterminate />
    </v-list-tile-avatar>

    <v-list-tile-title>{{ source.version }}</v-list-tile-title>
    <v-list-tile-sub-title>
      {{ source.date }}
    </v-list-tile-sub-title>

    <v-list-tile-action style="justify-content: flex-end;">
      <v-chip
        v-if="source.type !== 'common'"
        label
        :color="source.type === 'recommended' ? 'green' : ''"
      >{{ source.type }}</v-chip>
      <!-- <v-icon v-if="iconMapping[source.type]">{{iconMapping[source.type]}}</v-icon> -->
    </v-list-tile-action>
  </v-list-tile>
</template>

<script lang=ts>
import { defineComponent } from '@vue/composition-api';
import { Version } from '@xmcl/installer/forge';

export interface Props {
  source: Version;
  select: (version: { version: string }) => void;
  selected: string;
}

export default defineComponent<Props, {}>({
  props: {
    source: Object,
    select: Function,
    selected: String,
  },
});
</script>
