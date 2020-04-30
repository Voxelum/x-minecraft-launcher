<template>
  <v-menu
    v-model="show"
    :position-x="x"
    :position-y="y"
    absolute
    offset-y
    z-index="205"
  >
    <v-list>
      <v-list-tile
        v-for="(item, index) in items"
        :key="index"
        @click="item.onClick"
      >
        <v-list-tile-title>{{ item.title }}</v-list-tile-title>
      </v-list-tile>
    </v-list>
  </v-menu>
</template>

<script lang=ts>
import { defineComponent, inject, ref } from '@vue/composition-api';

export default defineComponent({
  setup() {
    const show = inject('context-menu', ref(false));
    const x = inject('context-menu-x', ref(0));
    const y = inject('context-menu-y', ref(0));
    const items = inject('context-menu-items', ref([]));

    return {
      show,
      x,
      y,
      items,
    };
  },
});
</script>

<style>
</style>
