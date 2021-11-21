<template>
  <v-list dark class="h-full flex flex-col overflow-auto" style="background-color: transparent;">
    <v-list-tile ripple @click="select({ version: '' })">
      <v-list-tile-avatar>
        <v-icon>close</v-icon>
      </v-list-tile-avatar>
      {{ $t('forge.disable') }}
    </v-list-tile>
    <virtual-list
      class="h-full overflow-y-auto"
      :data-sources="items"
      :data-key="'version'"
      :data-component="Tile"
      :keep="16"
      :extra-props="{ selected: selected, select: select, install: install }"
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
    install: required<(version: { version: string }) => void>(Function),
    selected: required<string>(String),

  },
  setup(props) {
    return {
      items: computed(() => props.value.map((v, i) => ({ ...v, status: props.status[v.version] }))),
      Tile,
    }
  },
})
</script>

<style>
</style>

