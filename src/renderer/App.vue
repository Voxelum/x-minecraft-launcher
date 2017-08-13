<template>
  <div id="app">
    <!-- <component v-bind:is="theme"> -->
    <!-- </component> -->
    <!-- <material></material> -->
    <semantic></semantic>
  </div>
</template>

<script>

import SemanticUi from './ui/semantic/Main'
import MaterialUi from './ui/material/Main'

import { mapState } from 'vuex'
export default {
  computed: {
    ...mapState('settings', ['theme'])
  },
  mounted() {

  },
  components: {
    semantic: SemanticUi,
    material: MaterialUi,
  }
}
</script>

<style>
#app {
  height: 780px;
}

.noselect {
  -webkit-touch-callout: none;
  -webkit-user-select: none;
  -khtml-user-select: none;
  -moz-user-select: none;
  -ms-user-select: none;
  user-select: none;
}
</style>
