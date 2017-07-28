<template>
  <div id="app">
    <ui></ui>
  </div>
  
</template>

<script>

import SemanticUi from './semantic-ui/Main'
// import MaterialUi from './material-ui/Main'

export default {
    components: { 
        ui: SemanticUi
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
