<template>
  <div style="display: flex !important; height: 100%; flex-direction: column;">
    <v-list-tile style="margin: 0px 0;">
      <v-checkbox v-model="showAlpha" :label="$t('minecraft.showAlpha')" />
    </v-list-tile>
    <v-divider dark />
    <refreshing-tile v-if="refreshing" />
    <minecraft-version-list
      v-else-if="versions.length !== 0"
      :value="version"
      :statuses="status"
      :versions="versions"
      :select="select"
    />
    <hint
      v-else
      v-ripple
      style="flex-grow: 1"
      icon="refresh"
      :text="$t('minecraft.noVersion', { version: version })"
      @click="refresh"
    />
  </div>
</template>

<script lang=ts>
import { defineComponent, computed } from '@vue/composition-api';
import {
  useMinecraftVersions,
  useMinecraftVersionFilter,
} from '@/hooks';
import { Version as MinecraftVersion } from '@xmcl/installer/minecraft';

interface Props {
  select: (v: MinecraftVersion) => void;
  filterText: string;
  version: string;
}

export default defineComponent<Props>({
  props: { select: Function, filterText: String, version: String },
  setup(props) {
    const { versions: vers, statuses, refreshing, refresh } = useMinecraftVersions();
    const { filter, showAlpha, acceptingRange } = useMinecraftVersionFilter(computed(() => props.filterText));
    const versions = computed(() => vers.value.filter(filter));

    return {
      showAlpha,
      acceptingRange,
      versions,
      refreshing,
      status: statuses,
      refresh,
    };
  },
});
</script>

<style scoped=true>
</style>
