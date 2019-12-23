<template>
  <v-list dark style="overflow-y: scroll; scrollbar-width: 0; background-color: transparent;" @mousewheel.stop>
    <template v-for="(item, index) in versions">
      <v-list-tile :key="index" :class="{ grey: value === item.id, 'darken-1': value === item.id }" ripple @click="selectVersion(item)">
        <v-list-tile-avatar>
          <v-icon v-if="statuses[item.id] !== 'loading'">
            {{ statuses[item.id] === 'remote' ? 'cloud' : 'folder' }}
          </v-icon>
          <v-progress-circular v-else :width="2" :size="24" indeterminate />
        </v-list-tile-avatar>

        <v-list-tile-title>
          {{ item.id }}
        </v-list-tile-title>
        <v-list-tile-sub-title v-if="showTime">
          {{ item.releaseTime }}
        </v-list-tile-sub-title>

        <v-list-tile-action style="justify-content: flex-end;">
          <v-chip :color="item.type === 'release' ? 'primary' : '' " label dark>
            {{ item.type }}
          </v-chip>
        </v-list-tile-action>
      </v-list-tile>
    </template>
  </v-list>
</template>

<script lang=ts>
import { createComponent, computed } from '@vue/composition-api';
import { LocalVersion } from 'universal/store/modules/version';
import { Installer } from '@xmcl/minecraft-launcher-core';
import { useMinecraftVersions, useIsCompatible } from '@/hooks';

export default createComponent({
  props: {
    showAlpha: {
      type: Boolean,
      default: () => false,
    },
    filterText: {
      type: String,
      default: () => '',
    },
    acceptingRange: {
      type: String,
      default: '[*]',
    },
    showTime: {
      type: Boolean,
      default: true,
    },
    value: {
      type: String,
      default: () => '',
    },
  },
  setup(props, context) {
    const { versions, statuses } = useMinecraftVersions();
    const { isCompatible } = useIsCompatible();
    function selectVersion(v: LocalVersion) {
      context.emit('input', v.id);
    }

    function filterMinecraft(v: Installer.VersionMeta) {
      if (!props.showAlpha && v.type !== 'release') return false;
      if (!isCompatible(props.acceptingRange, v.id)) return false;
      return v.id.indexOf(props.filterText) !== -1;
    }
    return {
      versions: computed(() => versions.value.filter(filterMinecraft)),
      statuses,
      selectVersion,
    };
  },
});
</script>

<style>
</style>
