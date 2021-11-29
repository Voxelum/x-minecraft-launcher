<template>
  <div style="display: flex !important; height: 100%; flex-direction: column;">
    <v-list-tile style="margin: 0px 0;">
      <v-checkbox v-model="showAlpha" :label="$t('minecraft.showAlpha')" />
    </v-list-tile>
    <v-divider dark />
    <refreshing-tile v-if="refreshing && versions.length === 0" />
    <virtual-list
      v-else-if="versions.length !== 0"
      ref="list"
      class="v-list"
      style="overflow-y: scroll; scrollbar-width: 0; background-color: transparent; transition: none;"
      :data-key="'id'"
      :data-component="MinecraftVersionListTile"
      :data-sources="versions"
      :keep="30"
      :extra-props="{ select: select, selected: version, showTime: true, statuses: statuses, install: install }"
    />
    <!-- <minecraft-version-list
      v-else-if="versions.length !== 0"
      :value="version"
      :statuses="statuses"
      :select="select"
      :install="install"
    /> -->
    <hint
      v-else
      v-ripple
      style="flex-grow: 1; cursor: pointer"
      icon="refresh"
      :text="$t('minecraft.noVersion', { version: version })"
      @click="refresh(true)"
    />
  </div>
</template>

<script lang=ts>
import { defineComponent, computed } from '@vue/composition-api'
import {
  useMinecraftVersions,
  useMinecraftVersionFilter,
} from '/@/hooks'
import { required } from '/@/util/props'
import { MinecraftVersion } from '@xmcl/installer'
import MinecraftVersionListTile from './MinecraftVersionListTile.vue'

export default defineComponent({
  props: {
    select: required<(v: MinecraftVersion) => void>(Function),
    filterText: required<string>(String),
    version: required<string>(String),
  },
  setup(props) {
    const { versions: vers, statuses, refreshing, refresh, install } = useMinecraftVersions()
    const { filter, showAlpha, acceptingRange } = useMinecraftVersionFilter(computed(() => props.filterText))
    const versions = computed(() => vers.value.filter(filter))

    return {
      showAlpha,
      acceptingRange,
      versions,
      refreshing,
      statuses,
      refresh,
      install,
      MinecraftVersionListTile,
    }
  },
})
</script>

<style scoped=true>
</style>
