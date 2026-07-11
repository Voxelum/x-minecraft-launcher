/**
 * This file is used specifically and only for development. It installs
 * `electron-debug` & `vue-devtools`. There shouldn't be any need to
 *  modify this file, but it can be used to extend your development
 *  environment.
 */

// Set environment for development
import { app, session } from 'electron'
import { VUEJS_DEVTOOLS } from 'electron-devtools-installer'
import { downloadChromeExtension } from 'electron-devtools-installer/dist/downloadChromeExtension'
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

app.whenReady().then(async () => {
  // Reimplement `electron-devtools-installer`'s install using the non-deprecated
  // `session.extensions` API. The published package still calls the deprecated
  // `session.getAllExtensions`/`session.loadExtension`, which prints trace warnings.
  try {
    const extensions = session.defaultSession.extensions
    const installed = extensions.getAllExtensions().find((e) => e.id === VUEJS_DEVTOOLS.id)
    if (installed) {
      console.log(`Vue devtool already loaded ${installed.name}`)
      return
    }
    const extensionFolder = await downloadChromeExtension(VUEJS_DEVTOOLS.id, {})
    const ext = await extensions.loadExtension(extensionFolder)
    console.log(`Installed vue devtool ${ext.name}`)
  } catch (e) {
    console.error('Fail to install vue devtool')
    console.error(e)
  }
})
