/**
 * This file is used specifically and only for development. It installs
 * `electron-debug` & `vue-devtools`. There shouldn't be any need to
 *  modify this file, but it can be used to extend your development
 *  environment.
 */

/* eslint-disable */

// Set environment for development
// process.env.NODE_ENV = 'development';

// Install `electron-debug` with `devtron`
require('electron-debug')({
    showDevTools: true
});

import { autoUpdater } from 'electron-updater';

autoUpdater.setFeedURL({
    provider: 'github',
    repo: 'x-minecraft-launcher',
    owner: 'voxelum',
});
autoUpdater.logger = null;

// Require `main` process to boot app
require('./index');