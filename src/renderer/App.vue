<template>
  <div id="app">
     <!-- <login></login>  -->
      <common></common>  
  </div>
</template>

<script>
import components from '@/components/widget'
import CommonPage from '@/components/CommonPage'
import Login from '@/components/Login'
require('semantic/dist/semantic.min.css')
require('semantic/dist/semantic.min.js')
export default {
  name: 'llauncher',
  components: { Common: CommonPage, Login }
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
<style lang="stylus">
    @import './assets/main'
</style>
