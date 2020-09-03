<template>
  <v-list-tile
    :key="source.version"
    :class="{ grey: selected === source.version, 'darken-1': selected === source.version }"
    ripple
    @click="select(source)"
  >
    <v-list-tile-avatar>
      <v-icon
        v-if="statuses[source.version] !== 'loading'"
      >
        {{ statuses[source.version] === 'remote' ? 'cloud' : 'folder' }}
      </v-icon>
      <v-progress-circular
        v-else
        :width="2"
        :size="24"
        indeterminate
      />
    </v-list-tile-avatar>

    <v-list-tile-title>{{ source.version }}</v-list-tile-title>

    <v-list-tile-action style="justify-content: flex-end;">
      <v-chip
        v-if="source.stable"
        label
        color="green"
      >
        stable
      </v-chip>
      <v-chip
        v-else
        label
      >
        unstable
      </v-chip>
    </v-list-tile-action>
  </v-list-tile>
</template>

<script lang=ts>
import { defineComponent } from '@vue/composition-api';
import { FabricInstaller } from '@xmcl/installer';
import VirtualList from 'vue-virtual-scroll-list';
import { required } from '@/util/props';

type FabricArtifactVersion = FabricInstaller.FabricArtifactVersion;

export default defineComponent({
  components: { VirtualList },
  props: {
    statuses: required<{}>(Object),
    source: required<FabricArtifactVersion>(Object),
    selected: required<string>(String),
    select: required<(version: FabricArtifactVersion) => void>(Function),
  },
});

</script>
