<template>
  <v-container v-if="refreshing" fill-height>
    <v-layout align-center justify-center row fill-height>
      <v-flex shrink>
        <v-progress-circular :size="100" color="white" indeterminate />
      </v-flex>
    </v-layout>
  </v-container>
  <v-list v-else-if="versions.length !== 0" dark style="overflow-y: scroll; scrollbar-width: 0; background-color: transparent;">
    <v-list-tile ripple @click="selectVersion({ version: null })">
      <v-list-tile-avatar>
        <v-icon> close </v-icon>
      </v-list-tile-avatar>
      {{ $t('forge.disable') }}
    </v-list-tile>
    <template v-for="(item, index) in versions">
      <v-list-tile 
        :key="index"
        :class="{ grey: value === item.version, 'darken-1': value === item.version }" 
        ripple 
        @click="selectVersion(item)">
        <v-list-tile-avatar>
          <v-icon v-if="statuses[item.version] !== 'loading'">
            {{ statuses[item.version] === 'remote' ? 'cloud' : 'folder' }}
          </v-icon>
          <v-progress-circular v-else :width="2" :size="24" indeterminate />
        </v-list-tile-avatar>

        <v-list-tile-title>
          {{ item.version }}
        </v-list-tile-title>
        <v-list-tile-sub-title v-if="showTime">
          {{ item.date }}
        </v-list-tile-sub-title>

        <v-list-tile-action style="justify-content: flex-end;">
          <v-chip v-if="item.type !== 'common'" label :color="item.type === 'recommended'?'green': ''">
            {{ item.type }}
          </v-chip>
          <!-- <v-icon v-if="iconMapping[item.type]">{{iconMapping[item.type]}}</v-icon> -->
        </v-list-tile-action>
      </v-list-tile>
    </template>
  </v-list>
  <v-container v-else fill-height>
    <v-layout align-center justify-center row fill-height>
      <v-flex shrink tag="h3" class="white--text">
        <v-btn outline large @click="refresh">
          <v-icon left>
            refresh
          </v-icon>
          {{ $t('forge.noVersion', { version: minecraft }) }}
        </v-btn>
      </v-flex>
    </v-layout>
  </v-container>
</template>

<script>
import { createComponent, reactive, ref, computed } from '@vue/composition-api';
import { useForgeVersions } from '@/hooks';

export default createComponent({
  props: {
    minecraft: {
      type: String,
      default: '',
    },
    value: {
      type: String,
      default: '',
    },
    showBuggy: {
      type: Boolean,
      default: false,
    },
    filterText: {
      type: String,
      default: '',
    },
    showTime: {
      type: Boolean,
      default: true,
    },
    recommendedOnly: {
      type: Boolean,
      default: false,
    },
  },
  setup(props, context) {
    const mcversion = computed(() => props.minecraft);
    const { statuses, versions, refreshing, refresh } = useForgeVersions(mcversion);
    function selectVersion(item) {
      context.emit('input', item.version);
    }
    function filterForge(version) {
      if (props.recommendedOnly && version.type !== 'recommended' && version.type !== 'latest') return false;
      if (props.showBuggy && version.type !== 'buggy') return true;
      return version.version.indexOf(props.filterText) !== -1;
    }
    const filteredVersions = computed(() => versions.value.filter(filterForge));
    return {
      iconMapping: {
        buggy: 'bug_report',
        recommended: 'star',
        latest: 'fiber_new',
      },
      statuses,
      versions: filteredVersions,
      refreshing,
      refresh,
      selectVersion,
    };
  },
});
</script>

<style>
</style>
