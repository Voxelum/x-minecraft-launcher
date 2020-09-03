<template>
  <v-container
    grid-list-xs
    fill-height
  >
    <v-layout
      row
      wrap
      justify-center
      align-center
      fill-height
    >
      <v-progress-circular
        :size="120"
        :width="15"
        :indeterminate="progress === -1"
        :value="progress / total * 100"
      >
        {{ $t(name) }}
      </v-progress-circular>
    </v-layout>
  </v-container>
</template>

<script lang=ts>
import { defineComponent, computed } from '@vue/composition-api';
import { useTaskFromServiceCall } from '@/hooks';
import { required } from '@/util/props';

export default defineComponent({
  props: { promise: required<Promise<any>>(Promise) },
  setup(props) {
    return useTaskFromServiceCall(computed(() => props.promise));
  },
});
</script>

<style>
</style>
