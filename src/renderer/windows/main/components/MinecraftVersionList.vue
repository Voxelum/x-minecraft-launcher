<template>
  <virtual-list
    ref="list"
    class="v-list"
    style="overflow-y: scroll; scrollbar-width: 0; background-color: transparent; transition: none;"
    :data-key="'id'"
    :data-component="Tile"
    :data-sources="versions"
    :keep="30"
    :extra-props="{ select: select, selected: value, showTime: showTime, statuses: statuses }"
  />
</template>

<script lang=ts>
import { defineComponent, ref, Ref, onMounted } from '@vue/composition-api';
import VirtualList from 'vue-virtual-scroll-list';
import { Version } from '@xmcl/installer/minecraft';
import { required } from '@/util/props';
import Tile from './MinecraftVersionListTile.vue';

export default defineComponent({
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
    statuses: required<Record<string, boolean>>(Object),
    versions: required<Array<Version>>(Array),
    select: required<(version: Version) => void>(Function),
  },
  setup(props) {
    const list: Ref<null | Vue> = ref(null);
    onMounted(() => {
      let index = props.versions.findIndex(v => v.id === props.value);
      (list.value! as any).scrollToIndex(index);
    });
    return { list, Tile };
  },
});
</script>

<style>
</style>
