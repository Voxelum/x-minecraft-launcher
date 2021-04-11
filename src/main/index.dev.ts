/**
 * This file is used specifically and only for development. It installs
 * `electron-debug` & `vue-devtools`. There shouldn't be any need to
 *  modify this file, but it can be used to extend your development
 *  environment.
 */

/* eslint-disable */

// Set environment for development
// process.env.NODE_ENV = 'development';

import { app, BrowserWindow } from 'electron';
import { autoUpdater } from 'electron-updater';
import { existsSync } from 'fs-extra';
import { Socket } from 'net';
import { join } from 'path';
import install, { VUEJS_DEVTOOLS } from 'electron-devtools-installer'
import './main';

app.on('web-contents-created', (event, contents) => {
  // const extensionDir = join(__dirname, '../extensions')
  // if (existsSync(extensionDir)) {
  //   contents.session.loadExtension(extensionDir)
  // }
  contents.openDevTools({ mode: 'detach' });
})

autoUpdater.setFeedURL({
  provider: 'github',
  repo: 'x-minecraft-launcher',
  owner: 'voxelum',
});
autoUpdater.logger = null;

app.whenReady().then(() => {
  install(VUEJS_DEVTOOLS).then((v) => {
    console.log(`Installed vue devtool ${v}`)
  }, (e) => {
    console.error(`Fail to install vue devtool`)
    console.error(e)
  })
})

const devServer = new Socket({}).connect(25555, '127.0.0.1')
devServer.on('data', () => {
  BrowserWindow.getAllWindows().forEach(w => w.reload())
})


