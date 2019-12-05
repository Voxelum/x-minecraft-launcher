<template>
  <v-container grid-list-xs fill-height>
    <v-layout row wrap justify-center align-center fill-height>
      <v-flex v-for="t in tasks" :key="t.id">
        {{ $t(t.name) }}
        <v-progress-circular :indeterminate="t.progress === -1" :value="t.progress / t.total" />
      </v-flex>
    </v-layout>
  </v-container>
</template>

<script lang=ts>
import { createComponent, computed } from '@vue/composition-api';
import { useStore } from '@/hooks';

export default createComponent({
  props: {
    value: {
      type: Promise,
      required: true,
    },
  },
  setup(props) {
    const promise: any = props.value;
    const { state } = useStore();
    const tasks = computed(() => state.task.tasks.filter(t => promise.__tasks__.indexOf(t.id) !== -1));
    return { tasks };
  },
});
</script>

<style>
</style>
