import { app } from 'electron';

process.on('SIGINT', () => {
    app.quit();
});

const devMod = process.env.NODE_ENV === 'development';
/**
 * Set `__static` path to static files in production
 * https://simulatedgreg.gitbooks.io/electron-vue/content/en/using-static-assets.html
 */
if (!devMod) {
    global.__static = require('path').join(__dirname, '/static').replace(/\\\\/g, '\\\\\\\\');
}

/* eslint-disable */
if (!app.requestSingleInstanceLock()) {
    app.quit();
}

if (!app.isDefaultProtocolClient('xmcl')) {
    app.setAsDefaultProtocolClient('xmcl');
}

import { Manager, Managers } from './manager';
import AppManager from "./manager/AppManager";
import NetworkManager from "./manager/NetworkManager";
import StoreAndServiceManager from "./manager/StoreAndServiceManager";
import TaskManager from "./manager/TaskManager";
import UpdateManager from "./manager/UpdateManager";
import LogManager from './manager/LogManager';

const managers: Managers = {
    AppManager: new AppManager(),
    NetworkManager: new NetworkManager(),
    StoreAndServiceManager: new StoreAndServiceManager(),
    TaskManager: new TaskManager(),
    UpdateManager: new UpdateManager(),
    LogManager: new LogManager(),
};
const manList: Manager[] = Object.values(managers);

async function main() {
    console.log(process.cwd())
    console.log(process.argv)
    manList.forEach(man => (man as any).managers = managers);
    await Promise.all(manList.map(async m => await m.setup(managers)));
    await Promise.all(manList.map(m => m.rootReady(managers.AppManager.root)));
    await app.whenReady();
    await Promise.all(manList.map(m => m.appReady(app)));
    await Promise.all(manList.map(m => m.storeReady(managers.StoreAndServiceManager.store!)));
}

main();

/* eslint-enable */
