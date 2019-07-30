<template>
  <v-container grid-list-xs fill-height>
    <v-layout row wrap justify-center align-center fill-height>
      {{ value }}
      <v-flex v-for="t in activeTasks" :key="t._internalId">
        {{ $t(t.name) }}
        <v-progress-circular :indeterminate="t.progress === -1" :value="t.progress / t.total" />
      </v-flex>
    </v-layout>
  </v-container>
</template>

<script>
export default {
  props: {
    value: {
      type: String,
      required: true,
    },
  },
  computed: {
    task() {
      if (this.value === '') return undefined;
      return this.$repo.state.task.tree[this.value];
    },
    activeTasks() {
      if (!this.task) return [];
      return this.task.tasks.filter(t => t.status === 'running');
    },
  },
};
</script>

<style>
</style>
