/**
 * This file is used specifically and only for development. It installs
 * `electron-debug` & `vue-devtools`. There shouldn't be any need to
 *  modify this file, but it can be used to extend your development
 *  environment.
 */

// Set environment for development
import { app } from 'electron'
import install, { VUEJS_DEVTOOLS } from 'electron-devtools-installer'
import { autoUpdater } from 'electron-updater'
import 'source-map-support/register'
import './index'

console.log(`Process id=${process.pid}`)

app.on('browser-window-created', (event, w) => {
  w.webContents.openDevTools({ mode: 'detach' })
})

app.on('web-contents-created', (event, contents) => {
  contents.on('update-target-url', (event, url) => {
    if (url.startsWith('http://localhost')) {
      contents.openDevTools({ mode: 'detach' })
    }
  })
})

autoUpdater.setFeedURL({
  provider: 'github',
  repo: 'x-minecraft-launcher',
  owner: 'voxelum',
})
autoUpdater.logger = null

app.whenReady().then(() => {
  install(VUEJS_DEVTOOLS).then((v) => {
    console.log(`Installed vue devtool ${v}`)
  }, (e) => {
    console.error('Fail to install vue devtool')
    console.error(e)
  })
})
