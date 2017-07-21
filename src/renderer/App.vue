<template>
  <div id="app">
    <semantic-ui></semantic-ui>
  </div>
</template>

<script>

import SemanticUi from './semantic-ui/Main'

export default {
  components: { SemanticUi }
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
