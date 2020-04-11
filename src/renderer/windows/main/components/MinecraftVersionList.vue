<template>
  <v-list dark style="overflow-y: scroll; scrollbar-width: 0; background-color: transparent;">
    <!-- <virtual-list :size="48" :remain="7">  -->
    <template v-for="(item) in versions">
      <v-list-tile :key="item.version" :class="{ grey: value === item.id, 'darken-1': value === item.id }" ripple @click="select(item)">
        <v-list-tile-avatar>
          <v-icon v-if="statuses[item.id] !== 'loading'">
            {{ statuses[item.id] === 'remote' ? 'cloud' : 'folder' }}
          </v-icon>
          <v-progress-circular v-else :width="2" :size="24" indeterminate />
        </v-list-tile-avatar>

        <v-list-tile-title>
          {{ item.id }}
        </v-list-tile-title>
        <v-list-tile-sub-title v-if="showTime">
          {{ item.releaseTime }}
        </v-list-tile-sub-title>

        <v-list-tile-action style="justify-content: flex-end;">
          <v-chip :color="item.type === 'release' ? 'primary' : '' " label dark>
            {{ item.type }}
          </v-chip>
        </v-list-tile-action>
      </v-list-tile>
    </template>
    <!-- </virtual-list> -->
  </v-list>
</template>

<script lang=ts>
import { createComponent } from '@vue/composition-api';
import VirtualList from 'vue-virtual-scroll-list';

export default createComponent({
  components: { VirtualList },
  props: {
    showTime: {
      type: Boolean,
      default: true,
    },
    value: {
      type: String,
      default: () => '',
    },
    statuses: Object,
    versions: Array,
    select: Function,
  },
});
</script>

<style>
</style>
