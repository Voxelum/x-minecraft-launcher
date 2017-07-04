<template>
  <div id="app">
    <common></common>
  </div>
</template>

<script>
import common from '@/components/CommonPage'
import login from '@/components/Login'
const { ipcRenderer } = require('electron')

export default {
  name: 'llauncher',
  mounted(e) {
    ipcRenderer.send('init')
    ipcRenderer.on('init', (event, args) => {
    })
  },
  components: {
    login, common
  }
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
