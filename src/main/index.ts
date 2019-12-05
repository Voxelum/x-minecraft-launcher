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

import { Manager } from './manager';
import AppManager from "./manager/AppManager";
import I18nManager from "./manager/I18nManager";
import NetworkManager from "./manager/NetworkManager";
import StoreAndServiceManager from "./manager/StoreAndServiceManager";
import TaskManager from "./manager/TaskManager";
import BootManager from "./manager/BootManager";
import UpdateManager from "./manager/UpdateManager";
import LogManager from './manager/LogManager';

const managers = {
    RootManager: new BootManager(),
    AppManager: new AppManager(),
    I18nManager: new I18nManager(),
    NetworkManager: new NetworkManager(),
    StoreAndServiceManager: new StoreAndServiceManager(),
    TaskManager: new TaskManager(),
    UpdateManager: new UpdateManager(),
    LogManager: new LogManager(),
};
const manList: Manager[] = Object.values(managers);

async function main() {
    console.log(process.argv)
    console.log(process.cwd())
    console.log(process.arch)

    console.log('start');
    manList.forEach(man => (man as any).managers = manList);
    await Promise.all(manList.map(async m => await m.setup(managers)));
    console.log('setup');
    await Promise.all(manList.map(m => m.rootReady(managers.RootManager.root)));
    console.log('rootReady');
    await app.whenReady();
    console.log('whenReady');
    await Promise.all(manList.map(m => m.appReady(app)));
    await Promise.all(manList.map(m => m.storeReady(managers.StoreAndServiceManager.store!)));
}

main();

/* eslint-enable */
