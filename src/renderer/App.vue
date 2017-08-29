<template>
  <div id="app" @drop="ondrop">
    <!-- <component v-bind:is="theme"> -->
    <!-- </component> -->
    <!-- <material></material> -->
    <!-- <semantic></semantic> -->
    <log></log>
  </div>
</template>

<script>
import SemanticUi from './ui/semantic/Main'
import MaterialUi from './ui/material/Main'
import Log from './Log'

import { mapState } from 'vuex'
export default {
  computed: {
    ...mapState('settings', ['theme'])
  },
  mounted() {
    let dragTimer;
    const store = this.$store
    $(document).on('dragover', function(e) {
      e.preventDefault()
      var dt = e.originalEvent.dataTransfer;
      if (dt.types && (dt.types.indexOf ? dt.types.indexOf('Files') != -1
        : dt.types.contains('Files'))) {
        if (!store.state.dragover) store.commit('dragover', true);
        window.clearTimeout(dragTimer);
      }
    });
    $(document).on('dragleave', function(e) {
      dragTimer = window.setTimeout(function() {
        store.commit('dragover', false);
      }, 25);
    });
  },
  methods: {
    ondrop(event) {
      event.preventDefault()
      this.$store.commit('dragover', false)
      return false;
    },
  },
  components: {
    semantic: SemanticUi,
    material: MaterialUi,
    log: Log,
  }
}
</script>

<style>
/* #app {
  height: 780px;
} */

.noselect {
  -webkit-touch-callout: none;
  -webkit-user-select: none;
  -khtml-user-select: none;
  -moz-user-select: none;
  -ms-user-select: none;
  user-select: none;
}
</style>
