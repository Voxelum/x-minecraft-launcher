<template>
  <v-list-tile
    :key="source.version"
    :class="{ grey: selected === source.id, 'darken-1': selected === source.id, 'elevation-2': selected === source.id }"
    ripple
    @click="select(source)"
  >
    <v-list-tile-avatar>
      <v-icon
        v-if="statuses[source.id] !== 'loading'"
      >{{ statuses[source.id] === 'remote' ? 'cloud' : 'folder' }}</v-icon>
      <v-progress-circular
        v-else
        :width="2"
        :size="24"
        indeterminate
      />
    </v-list-tile-avatar>

    <v-list-tile-title>{{ source.id }}</v-list-tile-title>
    <v-list-tile-sub-title v-if="showTime">{{ source.releaseTime }}</v-list-tile-sub-title>

    <v-list-tile-action style="justify-content: flex-end;">
      <v-chip
        :color="source.type === 'release' ? 'primary' : '' "
        label
        dark
      >{{ source.type }}</v-chip>
    </v-list-tile-action>
  </v-list-tile>
</template>

<script lang=ts>
import { defineComponent } from '@vue/composition-api';
import VirtualList from 'vue-virtual-scroll-list';
import { Version } from '@xmcl/installer/minecraft';
import { Status } from '@universal/store/modules/version';

export interface Props {
  showTime: boolean;
  selected: string;
  source: Version & { status: Status };
  statuses: Record<string, boolean>;
  select: (version: Version) => void;
}

export default defineComponent<Props, {}>({
  components: { VirtualList },
  props: {
    showTime: {
      type: Boolean,
      default: true,
    },
    source: Object,
    selected: String,
    select: Function,
    statuses: Object,
  },
});
</script>

<style>
</style>
