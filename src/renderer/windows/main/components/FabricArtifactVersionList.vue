<template>
  <v-list dark style="overflow-y: scroll; scrollbar-width: 0; background-color: transparent;">
    <virtual-list ref="list" :size="48" :remain="7"> 
      <template v-for="item in versions">
        <v-list-tile
          :key="item.version"
          :class="{ grey: version === item.version, 'darken-1': version === item.version }" 
          ripple 
          @click="select(item)">
          <v-list-tile-avatar>
            <v-icon v-if="statuses[item.version] !== 'loading'">
              {{ statuses[item.version] === 'remote' ? 'cloud' : 'folder' }}
            </v-icon>
            <v-progress-circular v-else :width="2" :size="24" indeterminate />
          </v-list-tile-avatar>

          <v-list-tile-title>
            {{ item.version }}
          </v-list-tile-title>

          <v-list-tile-action style="justify-content: flex-end;">
            <v-chip 
              v-if="item.stable"
              label 
              color="green">
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
    </virtual-list>
  </v-list>
</template>

<script lang=ts>
import { createComponent, watch, ref, onMounted } from '@vue/composition-api';
import { FabricInstaller } from '@xmcl/installer';
import VirtualList from 'vue-virtual-scroll-list';

type FabricArtifactVersion = FabricInstaller.FabricArtifactVersion;

export interface Props {
  statuses: {};
  versions: FabricArtifactVersion[];
  version: string;
  select: (version: FabricArtifactVersion) => void;
}
export default createComponent<Props>({
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
      watch(() => props.versions, () => {
        // console.log(list.value!);
        // list.value!.reset();
      });
    });
    return {
      list,
    };
  },
});

</script>
