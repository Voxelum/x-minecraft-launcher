<template>
  <v-list-tile
    :key="source.type"
    :class="{
      grey: selected.type === source.type && selected.patch === source.patch,
      'darken-1':
        selected.patch === source.patch && selected.type === source.type
    }"
    ripple
    @click="select(source)"
  >
    <v-list-tile-avatar>
      <!-- <v-icon
        v-if="statuses[source.version] !== 'loading'"
      >
        {{ statuses[source.version] === 'remote' ? 'cloud' : 'folder' }}
      </v-icon> -->
      <!-- <v-progress-circular
        v-else
        :width="2"
        :size="24"
        indeterminate
      /> -->
    </v-list-tile-avatar>

    <v-list-tile-title>{{ source.type }}_{{ source.patch }}</v-list-tile-title>
  </v-list-tile>
</template>

<script lang=ts>
import { defineComponent } from '@vue/composition-api';
import VirtualList from 'vue-virtual-scroll-list';
import { required } from '@/util/props';
import { OptifineVersion } from '@universal/entities/version.schema';

export default defineComponent({
  components: { VirtualList },
  props: {
    // statuses: required<Record<string, 'loading' | 'remote'>>(Object),
    source: required<OptifineVersion>(Object),
    selected: required<OptifineVersion>(Object),
    select: required<(version: OptifineVersion) => void>(Function),
  },
});

</script>
