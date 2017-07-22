<template>
  <div id="app">
    <MaterialUi></MaterialUi>
  </div>
  
</template>

<script>

import SemanticUi from './semantic-ui/Main'
import MaterialUi from './material-ui/Main'

export default {
  components: { MaterialUi }
}
</script>

<style>
.noselect {
  -webkit-touch-callout: none;
  -webkit-user-select: none;
  -khtml-user-select: none;
  -moz-user-select: none;
  -ms-user-select: none;
  user-select: none;
}
</style>
