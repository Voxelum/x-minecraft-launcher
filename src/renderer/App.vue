<template>
  <div id="app">
    <login></login>
  </div>
</template>

<script>
import CommonPage from '@/components/CommonPage'
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
    login
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
