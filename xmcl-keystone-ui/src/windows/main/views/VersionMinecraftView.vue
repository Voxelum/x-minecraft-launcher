<template>
  <div
    class="flex flex-col h-full"
  >
    <v-list-item
      class="flex-1 justify-end"
    >
      <v-checkbox
        v-model="showAlpha"
        :label="t('minecraft.showAlpha')"
      />
    </v-list-item>
    <v-divider />
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
    <Hint
      v-else
      v-ripple
      style="flex-grow: 1; cursor: pointer"
      icon="refresh"
      :text="t('minecraft.noVersion', { version: version })"
      @click="refresh(true)"
    />
  </div>
</template>

<script lang=ts>
import { defineComponent, computed } from '@vue/composition-api'
import { required } from '/@/util/props'
import { MinecraftVersion } from '@xmcl/installer'
import MinecraftVersionListTile from './VersionMinecraftListTile.vue'
import Hint from '/@/components/Hint.vue'
import RefreshingTile from '/@/components/RefreshingTile.vue'
import { useMinecraftVersionFilter, useMinecraftVersions } from '../composables/version'
import { useI18n } from '/@/composables'

export default defineComponent({
  components: { Hint, RefreshingTile },
  props: {
    select: required<(v: MinecraftVersion) => void>(Function),
    filterText: required<string>(String),
    version: required<string>(String),
  },
  setup(props) {
    const { versions: vers, statuses, refreshing, refresh, install } = useMinecraftVersions()
    const { filter, showAlpha, acceptingRange } = useMinecraftVersionFilter(computed(() => props.filterText))
    const versions = computed(() => vers.value.filter(filter))
    const { t } = useI18n()
    return {
      t,
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
