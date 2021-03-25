<template>
  <v-list
    dark
    style="background-color: transparent; overflow-x: hidden; overflow-y: hidden;"
  >
    <v-list-tile
      ripple
      @click="select({ version: '' })"
    >
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
import { defineComponent, ref, onMounted } from '@vue/composition-api'
import { FabricArtifactVersion } from '@xmcl/installer'
import { required } from '/@/util/props'
import VirtualList from 'vue-virtual-scroll-list'
import Tile from './FabricArtifactVersionListTile.vue'

export default defineComponent({
  components: { VirtualList },
  props: {
    statuses: required<{}>(Object),
    versions: required<FabricArtifactVersion[]>(Array),
    version: required<string>(String),
    select: required<(version: { version: string }) => void>(Function),
  },
  setup(props) {
    const list = ref<any>(null)
    onMounted(() => {
      const index = props.versions.findIndex(v => v.version === props.version);
      (list.value! as any).scrollToIndex(index)
    })
    return {
      list,
      Tile,
    }
  },
})

</script>
