<template>
  <v-container grid-list-xs fill-height style="overflow: auto;">
    <v-layout row wrap>
      <v-flex tag="h1" class="white--text" xs7>
        <span class="headline">{{ $tc('server.name', 2) }}</span>
      </v-flex>
    </v-layout>
  </v-container>
</template>

<script>
export default {
  data() {
    return {
      servers: [],
    };
  },
  mounted() {
    this.load();
  },
  methods: {
    async load() {
      const servers = await this.$repo.dispatch('loadProfileSeverData');
      this.servers = servers;
    },
  },
};
</script>

<style>
</style>
