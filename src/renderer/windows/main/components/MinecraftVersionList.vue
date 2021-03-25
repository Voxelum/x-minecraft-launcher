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
import { defineComponent, ref, Ref, onMounted } from '@vue/composition-api'
import VirtualList from 'vue-virtual-scroll-list'
import { MinecraftVersion } from '@xmcl/installer'
import { required, withDefault } from '/@/util/props'
import Tile from './MinecraftVersionListTile.vue'

export default defineComponent({
  components: { VirtualList },
  props: {
    showTime: withDefault(Boolean, () => true),
    value: withDefault(String, () => ''),
    statuses: required<Record<string, boolean>>(Object),
    versions: required<Array<MinecraftVersion>>(Array),
    select: required<(version: MinecraftVersion) => void>(Function),
  },
  setup(props) {
    const list: Ref<any> = ref(null)
    onMounted(() => {
      const index = props.versions.findIndex(v => v.id === props.value);
      (list.value! as any).scrollToIndex(index)
    })
    return { list, Tile }
  },
})
</script>

<style>
</style>
