/**
 * This file is used specifically and only for development. It installs
 * `electron-debug` & `vue-devtools`. There shouldn't be any need to
 *  modify this file, but it can be used to extend your development
 *  environment.
 */

/* eslint-disable */

// Set environment for development
// process.env.NODE_ENV = 'development';

import { autoUpdater } from 'electron-updater';
import { app, BrowserWindow } from 'electron'
import { Socket } from 'net'

require('electron').app.on('web-contents-created', (event, contents) => {
    contents.openDevTools();
})

autoUpdater.setFeedURL({
    provider: 'github',
    repo: 'x-minecraft-launcher',
    owner: 'voxelum',
});
autoUpdater.logger = null;

// Require `main` process to boot app

app.on('browser-window-created', (event, window) => {
  // if (!window.webContents.isDevToolsOpened()) {
  //   window.webContents.openDevTools()
  // }
})

const devServer = new Socket({}).connect(25555, '127.0.0.1')
devServer.on('data', () => {
  BrowserWindow.getAllWindows().forEach(w => w.reload())
})

import './main';
