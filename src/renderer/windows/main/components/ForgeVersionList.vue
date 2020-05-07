<template>
  <v-list dark style="overflow-y: scroll; scrollbar-width: 0; background-color: transparent;">
    <v-list-tile ripple @click="select({ version: '' })">
      <v-list-tile-avatar>
        <v-icon> close </v-icon>
      </v-list-tile-avatar>
      {{ $t('forge.disable') }}
    </v-list-tile>
    <virtual-list :size="48" :remain="6"> 
      <template v-for="(item) in value">
        <v-list-tile
          :key="item.version"
          :class="{ grey: selected === item.version, 'darken-1' : selected === item.version }" 
          ripple 
          @click="select(item)">
          <v-list-tile-avatar>
            <v-icon v-if="status[item.version] !== 'loading'">
              {{ status[item.version] === 'remote' ? 'cloud' : 'folder' }}
            </v-icon>
            <v-progress-circular v-else :width="2" :size="24" indeterminate />
          </v-list-tile-avatar>

          <v-list-tile-title>
            {{ item.version }}
          </v-list-tile-title>
          <!-- <v-list-tile-sub-title v-if="showTime">
          {{ item.date }}
        </v-list-tile-sub-title> -->

          <v-list-tile-action style="justify-content: flex-end;">
            <v-chip 
              v-if="item.type !== 'common'" 
              label 
              :color="item.type === 'recommended' ? 'green' : ''">
              {{ item.type }}
            </v-chip>
          <!-- <v-icon v-if="iconMapping[item.type]">{{iconMapping[item.type]}}</v-icon> -->
          </v-list-tile-action>
        </v-list-tile>
      </template>
    </virtual-list>
  </v-list>
</template>

<script lang=ts>
import { defineComponent } from '@vue/composition-api';
import { ForgeInstaller } from '@xmcl/installer';
import VirtualList from 'vue-virtual-scroll-list';

export type Status = 'loading' | 'folder' | 'cloud';

export interface Props {
  selected: string;
  value: ForgeInstaller.Version[];
  status: Status[];
  select: (version: { version: string }) => void;
}

export default defineComponent<Props>({
  components: { VirtualList },
  props: {
    value: Array,
    status: Object,
    select: Function,
    selected: String,
  },
  setup() {
    return {
      iconMapping: {
        buggy: 'bug_report',
        recommended: 'star',
        latest: 'fiber_new',
      },
    };
  },
});
</script>

<style>
</style>
