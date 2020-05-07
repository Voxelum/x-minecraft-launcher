<template>
  <v-list ref="list" dark style="overflow-y: scroll; scrollbar-width: 0; background-color: transparent;">
    <!-- <virtual-list :size="48" :remain="7">  -->
    <template v-for="(item) in versions">
      <v-list-tile :key="item.version" :class="{ grey: value === item.id, 'darken-1': value === item.id, 'elevation-2': value === item.id }" ripple @click="select(item)">
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
import { defineComponent, ref, Ref } from '@vue/composition-api';
import VirtualList from 'vue-virtual-scroll-list';
import Vue from 'vue';
import { Version } from '@xmcl/installer/minecraft';
import { useScrollToOnMount } from '@/hooks';

interface Props {
  showTime: boolean;
  value: string;
  statuses: Record<string, boolean>;
  versions: Array<Version>;
  select: (version: Version) => void;
}

export default defineComponent<Props>({
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
  setup(props) {
    const list: Ref<null | Vue> = ref(null);
    useScrollToOnMount(list, () => {
      let index = props.versions.findIndex(v => v.id === props.value);
      let yOffset = Math.max(0, index - 2) * 48;
      return yOffset;
    });
    return { list };
  },
});
</script>

<style>
</style>
