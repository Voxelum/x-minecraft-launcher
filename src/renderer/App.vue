<template>
  <div id="app">
    <side></side>
  </div>
</template>

<script>
import common from '@/components/CommonPage'
import side from '@/components/Sidebar'
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
    login, side
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
