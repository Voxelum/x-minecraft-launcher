<template>
  <v-list
    dark
    style="background-color: transparent; height: 100%;"
  >
    <v-list-tile
      ripple
      @click="select({ version: '' })"
    >
      <v-list-tile-avatar>
        <v-icon>close</v-icon>
      </v-list-tile-avatar>
      {{ $t('forge.disable') }}
    </v-list-tile>
    <virtual-list
      style="overflow-y: auto; scrollbar-width: 0; height: 90%"
      :data-sources="items"
      :data-key="'version'"
      :data-component="Tile"
      :keep="16"
      :extra-props="{ selected: selected, select: select }"
    />
  </v-list>
</template>

<script lang=ts>
import { defineComponent, computed } from '@vue/composition-api'
import { ForgeVersion } from '@xmcl/installer'
import { required } from '/@/util/props'
import VirtualList from 'vue-virtual-scroll-list'
import Tile from './ForgeVersionListTile.vue'

export type Status = 'loading' | 'folder' | 'cloud'

export default defineComponent({
  components: { VirtualList },
  props: {
    value: required<ForgeVersion[]>(Array),
    status: required<Record<string, Status>>(Object),
    select: required<(version: { version: string }) => void>(Function),
    selected: required<string>(String),
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
    }
  },
})
</script>

<style>
</style>
