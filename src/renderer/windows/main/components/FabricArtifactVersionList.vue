<template>
  <v-list dark style="background-color: transparent;">
    <v-list-tile ripple @click="select({ version: '' })">
      <v-list-tile-avatar>
        <v-icon>close</v-icon>
      </v-list-tile-avatar>
      {{ $t('fabric.disable') }}
    </v-list-tile>
    <virtual-list
      ref="list"
      style="overflow-y: scroll; scrollbar-width: 0; height: 100%"
      :data-sources="versions"
      :data-key="'version'"
      :data-component="Tile"
      :keep="16"
      :extra-props="{ selected: version, select: select, statuses: statuses }"
    />
  </v-list>
</template>

<script lang=ts>
import { defineComponent, ref, onMounted } from '@vue/composition-api';
import { FabricInstaller } from '@xmcl/installer';
import VirtualList from 'vue-virtual-scroll-list';
import Tile from './FabricArtifactVersionListTile.vue';

type FabricArtifactVersion = FabricInstaller.FabricArtifactVersion;

export interface Props {
  statuses: {};
  versions: FabricArtifactVersion[];
  version: string;
  select: (version: FabricArtifactVersion) => void;
}
export default defineComponent<Props>({
  components: { VirtualList },
  props: {
    statuses: Object,
    versions: Array,
    version: String,
    select: Function,
  },
  setup(props) {
    let list = ref<any>(null);
    onMounted(() => {
      let index = props.versions.findIndex(v => v.version === props.version);
      (list.value! as any).scrollToIndex(index);
    });
    return {
      list,
      Tile,
    };
  },
});

</script>
