<template>
  <v-list
    dark
    style="
      background-color: transparent;
      overflow-x: hidden;
      overflow-y: hidden;
    "
  >
    <v-list-tile
      ripple
      @click="select(undefined)"
    >
      <v-list-tile-avatar>
        <v-icon>close</v-icon>
      </v-list-tile-avatar>
      {{ $t("optifine.disable") }}
    </v-list-tile>
    <virtual-list
      ref="list"
      style="overflow-y: scroll; scrollbar-width: 0; height: 100%"
      :data-sources="versions"
      :data-key="'_id'"
      :data-component="Tile"
      :keep="16"
      :extra-props="{ selected: version, select: select, statuses }"
    />
  </v-list>
</template>

<script lang=ts>
import { defineComponent, onMounted, ref } from '@vue/composition-api'
import VirtualList from 'vue-virtual-scroll-list'
import Tile from './OptifineVersionListTile.vue'
import { required } from '/@/util/props'
import { Status } from '/@shared/entities/version'
import { OptifineVersion } from '/@shared/entities/version.schema'

export default defineComponent({
  components: { VirtualList },
  props: {
    statuses: required<Record<string, Status>>(Object),
    versions: required<OptifineVersion[]>(Array),
    version: required<OptifineVersion>(Object),
    select: required<(version: OptifineVersion | undefined) => void>(Function),
  },
  setup(props) {
    const list = ref<any>(null)
    onMounted(() => {
      const index = props.versions.findIndex(v => v.type === props.version.type && v.patch === props.version.patch);
      (list.value! as any).scrollToIndex(index)
    })
    return {
      list,
      Tile,
    }
  },
})

</script>
