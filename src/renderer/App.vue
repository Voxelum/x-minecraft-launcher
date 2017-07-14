<template>
  <div id="app">
    <common-page></common-page>
  </div>
</template>

<script>
import components from '@/components/widget'
import CommonPage from '@/components/CommonPage'
require('semantic/dist/semantic.min.css')
require('semantic/dist/semantic.min.js')
const { ipcRenderer } = require('electron')
export default {
  name: 'llauncher',
  mounted(e) {
    ipcRenderer.send('init')
    ipcRenderer.on('init', (event, args) => {
    })
  },
  components: { CommonPage }
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
