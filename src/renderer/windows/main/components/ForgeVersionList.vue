<template>
  <v-list dark style="background-color: transparent; height: 100%; overflow: auto;">
    <v-list-tile ripple @click="select({ version: '' })">
      <v-list-tile-avatar>
        <v-icon>close</v-icon>
      </v-list-tile-avatar>
      {{ $t('forge.disable') }}
    </v-list-tile>
    <virtual-list
      style="overflow-y: scroll; scrollbar-width: 0; height: 100%"
      :data-sources="items"
      :data-key="'version'"
      :data-component="Tile"
      :keep="16"
      :extra-props="{ selected: selected, select: select }"
    />
  </v-list>
</template>

<script lang=ts>
import { defineComponent, computed } from '@vue/composition-api';
import { ForgeInstaller } from '@xmcl/installer';
import VirtualList from 'vue-virtual-scroll-list';
import Tile from './ForgeVersionListTile.vue';

export type Status = 'loading' | 'folder' | 'cloud';

export interface Props {
  selected: string;
  value: ForgeInstaller.Version[];
  status: Record<string, Status>;
  select: (version: { version: string }) => void;
}

export default defineComponent<Props>({
  components: { VirtualList },
  props: {
    value: Array,
    status: Object,
    select: Function,
    selected: String,
  },
  setup(props) {
    return {
      items: computed(() => props.value.map((v, i) => ({ ...v, status: props.status[v.version] }))),
      iconMapping: {
        buggy: 'bug_report',
        recommended: 'star',
        latest: 'fiber_new',
      },
      Tile,
    };
  },
});
</script>

<style>
</style>
